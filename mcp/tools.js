// tools.js — registers all 8 MCP tools on an McpServer. All domain logic comes
// from ../core (single source of truth); this file only adapts shapes/inputs.
import { z } from 'zod'
import {
  LT,
  PORTS_DATA,
  PREREQ_DATA,
  computeSizing,
  findVlanConflicts,
  findIpConflicts,
  findCidrOverlaps,
} from '../core/index.js'
import { CORPUS, searchCorpus, getById } from './corpus.js'

// --- sizing defaults (mirror the Excel workbook / index.html defaults) --------
// computeSizing requires a fully-populated object, so partial tool calls are
// deep-merged onto these defaults.
const SIZING_DEFAULTS = {
  hostCores: 128,
  hostRAM: 1024,
  cpuOverSub: '1',
  storageType: 'vSAN-ESA',
  growthPct: 10,
  opsReservePct: 30,
  clusterModel: 'High Availability (Three-Node)',
  instanceProfileSize: 'Medium',
  vcfInstanceModel: 'First Instance',
  logReplicaCount: 1,
  wldCount: 0,
  components: {
    sddc_manager: true,
    vcenter: true,
    nsx_manager: true,
    nsx_edge: false,
    vcf_operations: false,
    vcf_logs: false,
    avi_lb: false,
    vcfa: false,
    ssp: false,
    vcf_svc_runtime: true,
    cloud_proxy: false,
    license_server: false,
    vcf_ops_networks: false,
    vcf_ops_networks_collector: false,
    realtime_metrics: false,
    identity_broker: false,
    software_depot: false,
    vrms: false,
    srm: false,
    hvm: false,
    cloud_ransomware: false,
    hcx_connector: false,
  },
  compSizes: {
    vcenter: 'Medium',
    vcenterStorage: 'Large',
    wldVcSize: 'Small',
    nsx_manager: 'Medium',
    nsx_manager_model: 'Mandatory - HA Cluster',
    nsx_edge: 'NSX Edge Medium',
    vcf_operations: 'Small',
    vcf_logs: 'Small',
    avi_lb: 'Small',
    vcfa: 'Small',
    cloud_proxy: 'Medium',
    ssp: 'Medium',
    identity_broker: 'Small',
    vcf_ops_networks: 'Small',
    vcf_ops_networks_collector: 'Small',
    vrms: 'Light',
    srm: 'Light',
  },
}

function mergeSizing(partial = {}) {
  const p = partial || {}
  return {
    ...SIZING_DEFAULTS,
    ...p,
    components: { ...SIZING_DEFAULTS.components, ...(p.components || {}) },
    compSizes: { ...SIZING_DEFAULTS.compSizes, ...(p.compSizes || {}) },
  }
}

// --- Zod schemas -------------------------------------------------------------
const componentsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(SIZING_DEFAULTS.components).map((k) => [k, z.boolean().optional()]),
    ),
  )
  .partial()
  .optional()
  .describe('Boolean flags toggling each VCF component on/off.')

const compSizesSchema = z
  .object(
    Object.fromEntries(
      Object.keys(SIZING_DEFAULTS.compSizes).map((k) => [k, z.string().optional()]),
    ),
  )
  .partial()
  .optional()
  .describe('Per-component size tier selections (e.g. vcenter: "Medium").')

const sizingShape = {
  hostCores: z.number().optional().describe('Physical CPU cores per host (e.g. 128).'),
  hostRAM: z.number().optional().describe('Physical RAM per host in GB (e.g. 1024).'),
  cpuOverSub: z.string().optional().describe('vCPU:pCPU oversubscription ratio (e.g. "1").'),
  storageType: z.string().optional().describe('Storage type, e.g. "vSAN-ESA", "vSAN-OSA".'),
  growthPct: z.number().optional().describe('Headroom growth percentage.'),
  opsReservePct: z.number().optional().describe('vSAN operations reserve percentage.'),
  clusterModel: z
    .string()
    .optional()
    .describe('"High Availability (Three-Node)" or "Simple".'),
  instanceProfileSize: z.string().optional().describe('Instance profile size, e.g. "Medium".'),
  vcfInstanceModel: z
    .string()
    .optional()
    .describe('"First Instance" or "Additional Instance".'),
  logReplicaCount: z.number().optional().describe('VCF Operations for Logs replica count.'),
  wldCount: z.number().optional().describe('Number of workload domains.'),
  components: componentsSchema,
  compSizes: compSizesSchema,
}

// Accept either an array of {label,value} or an object map {label: value}.
const entriesSchema = z
  .union([
    z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })),
    z.record(z.string(), z.union([z.string(), z.number()])),
  ])
  .optional()

function normalizeEntries(input) {
  if (!input) return []
  if (Array.isArray(input)) {
    return input.map((e) => ({ label: String(e.label), value: String(e.value) }))
  }
  return Object.entries(input).map(([label, value]) => ({
    label: String(label),
    value: String(value),
  }))
}

// --- result helper -----------------------------------------------------------
// Every tool returns the result both as a JSON text block (broad client support,
// incl. ChatGPT) and as structuredContent (modern MCP clients).
function ok(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  }
}

// --- registration ------------------------------------------------------------
export function registerTools(server) {
  // 1. Sizing calculator
  server.registerTool(
    'calculate_management_domain_sizing',
    {
      title: 'Calculate VCF Management Domain Sizing',
      description:
        'Compute VCF 9.1 management-domain sizing (host count, raw/total CPU/RAM/disk, per-host disk, and a full per-component breakdown). Accepts a partial sizing object; unspecified fields fall back to Excel-workbook defaults.',
      inputSchema: sizingShape,
    },
    async (args) => {
      const sizing = mergeSizing(args)
      const result = computeSizing(sizing)
      return ok({ input: sizing, result })
    },
  )

  // 2. Component spec lookup
  server.registerTool(
    'lookup_component_specs',
    {
      title: 'Lookup Component Specs',
      description:
        'Return the resource spec (vCPU/RAM/disk) for a VCF component from the lookup tables. For tiered components, pass a size to get one tier, or omit it to get all tiers.',
      inputSchema: {
        component_key: z
          .string()
          .describe('LT key, e.g. "vcenter", "sddc_manager", "nsx_edge".'),
        size: z
          .string()
          .optional()
          .describe('Optional size tier, e.g. "Medium", "NSX Edge Large".'),
      },
    },
    async ({ component_key, size }) => {
      const value = LT[component_key]
      if (value === undefined) {
        return ok({
          component_key,
          found: false,
          available_keys: Object.keys(LT),
        })
      }
      const isSpec =
        value && typeof value === 'object' && ('vcpu' in value || 'ram' in value || 'disk' in value)
      if (isSpec || typeof value !== 'object') {
        // flat / scalar
        return ok({ component_key, tiered: false, spec: value })
      }
      // tiered or map
      if (size !== undefined) {
        const tier = value[size]
        return ok({
          component_key,
          tiered: true,
          size,
          spec: tier ?? null,
          found: tier !== undefined,
          available_sizes: Object.keys(value),
        })
      }
      return ok({
        component_key,
        tiered: true,
        available_sizes: Object.keys(value),
        specs: value,
      })
    },
  )

  // 3. Component catalog
  server.registerTool(
    'list_component_catalog',
    {
      title: 'List Component Catalog',
      description:
        'List every component key in the lookup tables, its shape (flat spec, tiered, or scalar/nested), and its available size tiers.',
      inputSchema: {},
    },
    async () => {
      const isSpec = (o) =>
        o && typeof o === 'object' && ('vcpu' in o || 'ram' in o || 'disk' in o)
      const catalog = Object.entries(LT).map(([key, value]) => {
        if (value == null || typeof value !== 'object') {
          return { key, shape: 'scalar', value }
        }
        if (isSpec(value)) {
          return { key, shape: 'flat', spec: value }
        }
        const subKeys = Object.keys(value)
        if (subKeys.length && isSpec(value[subKeys[0]])) {
          return { key, shape: 'tiered', sizes: subKeys }
        }
        return { key, shape: 'nested', sizes: subKeys }
      })
      return ok({ count: catalog.length, catalog })
    },
  )

  // 4. Ports & protocols search
  server.registerTool(
    'search_ports_protocols',
    {
      title: 'Search Ports & Protocols',
      description:
        'Filter the VCF ports/protocols firewall matrix by product, port, protocol, direction, and/or a free-text query (matches across all fields).',
      inputSchema: {
        product: z.string().optional().describe('Filter by product (substring, case-insensitive).'),
        port: z.union([z.string(), z.number()]).optional().describe('Filter by exact port number.'),
        protocol: z.string().optional().describe('Filter by protocol, e.g. "TCP", "UDP".'),
        direction: z.string().optional().describe('Filter by direction, e.g. "Inbound", "Outbound".'),
        query: z.string().optional().describe('Free-text substring matched across all fields.'),
        limit: z.number().optional().describe('Max rows to return (default 100).'),
      },
    },
    async ({ product, port, protocol, direction, query, limit }) => {
      const cap = limit ?? 100
      const lc = (s) => String(s ?? '').toLowerCase()
      let rows = PORTS_DATA
      if (product) rows = rows.filter((r) => lc(r.product).includes(lc(product)))
      if (port !== undefined) rows = rows.filter((r) => String(r.port) === String(port))
      if (protocol) rows = rows.filter((r) => lc(r.protocol) === lc(protocol))
      if (direction) rows = rows.filter((r) => lc(r.direction).includes(lc(direction)))
      if (query) {
        const q = lc(query)
        rows = rows.filter((r) =>
          [r.product, r.port, r.protocol, r.source, r.destination, r.direction, r.purpose, r.description]
            .some((f) => lc(f).includes(q)),
        )
      }
      const total = rows.length
      const results = rows.slice(0, cap)
      return ok({ total, returned: results.length, capped: total > cap, results })
    },
  )

  // 5. Prerequisites
  server.registerTool(
    'list_prerequisites',
    {
      title: 'List Prerequisites',
      description:
        'List VCF deployment prerequisites, optionally filtered by category (group title) and/or a free-text query over component/requirement/notes.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Filter by category title (substring), e.g. "Network", "Server Hardware".'),
        query: z.string().optional().describe('Free-text substring over component/requirement/notes.'),
      },
    },
    async ({ category, query }) => {
      const lc = (s) => String(s ?? '').toLowerCase()
      let groups = PREREQ_DATA
      if (category) groups = groups.filter((g) => lc(g.title).includes(lc(category)))
      if (query) {
        const q = lc(query)
        groups = groups
          .map((g) => ({
            title: g.title,
            rows: (g.rows || []).filter((r) =>
              [r.component, r.requirement, r.notes].some((f) => lc(f).includes(q)),
            ),
          }))
          .filter((g) => g.rows.length)
      }
      const rowCount = groups.reduce((n, g) => n + (g.rows || []).length, 0)
      return ok({ categories: groups.length, rowCount, groups })
    },
  )

  // 6. Network validation
  server.registerTool(
    'validate_network',
    {
      title: 'Validate Network',
      description:
        'Detect VLAN duplicates, IP-address duplicates, and CIDR overlaps. Each input may be an array of {label,value} or an object map {label: value}.',
      inputSchema: {
        vlans: entriesSchema.describe('VLAN IDs to check for duplicates.'),
        ips: entriesSchema.describe('IP addresses to check for duplicates.'),
        cidrs: entriesSchema.describe('CIDR ranges to check for overlaps.'),
      },
    },
    async ({ vlans, ips, cidrs }) => {
      const vlanEntries = normalizeEntries(vlans)
      const ipEntries = normalizeEntries(ips)
      const cidrEntries = normalizeEntries(cidrs)
      const vlanConflicts = findVlanConflicts(vlanEntries)
      const ipConflicts = findIpConflicts(ipEntries)
      const cidrOverlaps = findCidrOverlaps(cidrEntries)
      return ok({
        vlanConflicts,
        ipConflicts,
        cidrOverlaps,
        hasConflicts:
          vlanConflicts.length > 0 || ipConflicts.length > 0 || cidrOverlaps.length > 0,
      })
    },
  )

  // 7. search (ChatGPT Deep Research)
  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Search the VCF Planner knowledge corpus (ports, prerequisites, component specs, planning fields). Returns matching documents as {id, title, url}. Use fetch to retrieve full content.',
      inputSchema: {
        query: z.string().describe('Search query.'),
      },
    },
    async ({ query }) => {
      const results = searchCorpus(query).map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
      }))
      return ok({ results })
    },
  )

  // 8. fetch (ChatGPT Deep Research)
  server.registerTool(
    'fetch',
    {
      title: 'Fetch',
      description:
        'Fetch the full content of a single corpus document by id (as returned by search). Returns {id, title, text, url, metadata}.',
      inputSchema: {
        id: z.string().describe('Document id, e.g. "port:0", "prereq:0.1", "component:vcenter".'),
      },
    },
    async ({ id }) => {
      const doc = getById(id)
      if (!doc) {
        return ok({ id, title: 'Not found', text: '', url: '', metadata: { found: false } })
      }
      return ok({
        id: doc.id,
        title: doc.title,
        text: doc.text,
        url: doc.url,
        metadata: doc.metadata,
      })
    },
  )

  return server
}

export { mergeSizing, SIZING_DEFAULTS }
