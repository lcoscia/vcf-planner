// VCF 5.2 → 9.x upgrade comparison of the Ports & Protocols matrix — hand-maintained logic around the
// two generated datasets: PORTS_DATA (core/ports.js, VCF 9.x) and PORTS_5X_DATA (core/ports-5x.js, VCF 5.2).
//
// A 9.x flow is matched to 5.2 on port + protocol + normalized source/destination labels (products were
// renamed, split and merged between 5.2 and 9.x, so the product name is not part of the key):
//   unchanged  same port / protocol / endpoints (after renames such as Aria Operations → VCF Operations)
//   changed    same port / protocol / product line, one endpoint matches and the other one changed
//   review     same port / protocol / product line, endpoints could not be matched — check by hand
//   added      no 5.2 flow on that port in that product line
//   transient  needed for the upgrade window only (VCF Installer, legacy Log Insight migration, …)
//   removed    5.2 flow with no 9.x equivalent — close after the upgrade / decommission (see `note`)
// Not imported by core/index.js: the site loads this module (and the 5.2 dataset) on demand.

import { PORTS_DATA } from './ports.js'
import { PORTS_5X_DATA, PORTS_5X_BOM } from './ports-5x.js'
import { portsProductInPlan } from './ports-meta.js'

export { PORTS_5X_BOM }
export const PORTS_UPGRADE_FROM = '5.2'
// Direct 5.2 → 9.1 is the supported path that skips the 9.0-only appliances (fleet management, standalone
// Identity Broker), so only the 9.1 buckets are offered as targets.
export const PORTS_UPGRADE_TARGETS = ['9.1', '9.1.1']

export const PORTS_UPGRADE_STATUSES = [
  { id: 'added', label: 'New in 9.x', hint: 'No VCF 5.2 equivalent: open it' },
  { id: 'changed', label: 'Changed', hint: 'Same port, the source or the destination changed: update the rule' },
  { id: 'transient', label: 'Upgrade only', hint: 'Needed during the upgrade window, close it afterwards' },
  { id: 'review', label: 'Needs review', hint: 'Same port in the same product line, endpoints could not be matched automatically' },
  { id: 'removed', label: 'Removed', hint: 'No VCF 9.x equivalent found: close it once the component is decommissioned (see the note)' },
  { id: 'unchanged', label: 'Unchanged', hint: 'Already open in VCF 5.2' },
]

// 9.x product → product line shared with the 5.2 rows (row.family in core/ports-5x.js).
// null = own release train, not tied to the VCF version: left out of the comparison.
export const PORTS_UPGRADE_FAMILY = {
  'SDDC Manager': 'sddc', 'vCenter': 'vsphere', 'ESX': 'vsphere', 'vSAN': 'vsan', 'NSX': 'nsx',
  'VCF Operations': 'ops', 'Log Management': 'logs', 'VCF Automation': 'automation',
  'VCF Operations orchestrator': 'automation', 'VCF Operations Fleet Manager': 'fleet',
  'VCF Management Services': 'vcfms', 'Identity Broker': 'identity', 'VCF Operations HCX': 'hcx',
  'VCF Operations for Networks': 'opsnet', 'vSphere Replication': 'vr', 'Protection and Recovery': 'vr',
  'Protection and Recovery Service for VCF Automation': 'vr', 'VMware Live Recovery cloud': 'vr',
  'DSM Data Services': 'dsm', 'VMware Private AI Services': 'pais',
  'Avi Load Balancer': null, 'VMware vDefend': null,
}

// ─── endpoint label normalization (renames + wording noise) ───
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim()
const ALIASES = [
  [/\b(vrealize|vmware aria|aria) log insight\b|\b(vmware )?aria operations for logs\b|\bvrli\b|\blog insight\b/g, 'vcf operations for logs'],
  [/\b(vmware )?aria operations for networks\b|\bvrealize network insight\b|\bvrni\b/g, 'vcf operations for networks'],
  [/\bvrealize operations( manager)?\b|\b(vmware )?aria operations\b|\bvrops\b/g, 'vcf operations'],
  [/\bvrealize automation\b|\b(vmware )?aria automation\b|\bvra\b/g, 'vcf automation'],
  [/\bvrealize suite lifecycle manager\b|\b(vmware )?aria suite lifecycle( manager)?\b|\bvrslcm\b/g, 'vcf operations fleet manager'],
  [/\b(vmware )?workspace one access\b|\bws1 access\b|\bvmware identity manager\b|\bvidm\b|\b(vmware |vcf )?identity broker\b/g, 'vcf identity broker'],
  [/\bvrealize orchestrator\b/g, 'vcf operations orchestrator'],
  [/\besxi\b|\bexsi\b/g, 'esx'],
  [/\bnsx-t\b/g, 'nsx'],
  [/\bdns (server\(s\)|servers?|resolvers?)\b/g, 'dns'],
  [/\bntp (server\(s\)|servers?)\b/g, 'ntp'],
  [/\badministrative \/ management network\(s\)|\bmanagement workstations?\b|\buser \/ client\b/g, 'mgmtws'],
  [/\bnsx edges? nodes?\b|\bnsx edges\b/g, 'nsx edge'],
  [/\bnsx managers\b/g, 'nsx manager'],
  [/\bcloud foundation components\b/g, 'vcf components'],
  [/\bvcenter servers?\b/g, 'vcenter'],
]
const NOISE = [
  /\((cluster|nodes?|cluster vip and nodes|cluster and nodes|cluster nodes( and collector nodes)?|vip)\)/g,
  /\b(for )?(the )?(management|workload)( domain)?(s)?(\/(management|workload) domains?)?\b/g,
  /\bfor management\/workload domains\b/g,
  /\b(management )?ip address(es)?\b/g, /\bfqdn\b/g, /\bappliances?\b/g, /\bcluster\b/g,
  /\bservers?\b/g, /\bhosts?\b/g, /\bnodes?\b/g, /\(s\)/g, /\bthe\b/g, /\bfor\b/g,
]
export function normPortsLabel(label) {
  let s = clean(label).toLowerCase()
  for (const [re, to] of ALIASES) s = s.replace(re, to)
  for (const re of NOISE) s = s.replace(re, ' ')
  s = s.replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s.replace(/s$/, '')
}
const tokens = s => new Set(s.split(/[ /]+/).filter(w => w.length > 1))
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b)
  if (!A.size && !B.size) return 1
  let i = 0
  for (const x of A) if (B.has(x)) i++
  return i / (A.size + B.size - i)
}
const SIMILAR = 0.5, REVIEW = 0.25

const INTERNAL_RE = /\binternal\b|loopback|localhost|127\.0\.0\.1/i
export const isInternalFlow = r => INTERNAL_RE.test(r.source) || INTERNAL_RE.test(r.destination)
const CLOUD_BUILDER_RE = /\bcloud builder\b/i
const isCloudBuilder = r => CLOUD_BUILDER_RE.test(r.source) || CLOUD_BUILDER_RE.test(r.destination)

// ─── upgrade-window flows ───
// 9.x rows only needed while upgrading (status forced to 'transient', with the reason).
export const PORTS_UPGRADE_TRANSIENT_RULES = [
  {
    test: r => /legacy log insight/i.test(r.destination),
    note: 'Migration from the legacy Aria Operations for Logs cluster to Log Management: close once the migration is done (legacy logs stay queryable for 90 days).',
    ref: 'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-operations-for-logs.html',
  },
  {
    test: r => /\bvcf installer\b/i.test(r.source) || /\bvcf installer\b/i.test(r.destination),
    note: 'VCF Installer appliance (upgrade pre-checks, converge / import): only while the appliance is deployed.',
    ref: 'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html',
  },
]
// Upgrade-window flows the Broadcom matrix does not list.
export const PORTS_UPGRADE_EXTRA = [
  {
    product: 'VCF Download Tool', family: 'sddc', port: '443', protocol: 'TCP', direction: 'Outbound',
    source: 'VCF Download Tool host', destination: 'Broadcom public URLs (dl.broadcom.com, eapi.broadcom.com)',
    purpose: 'Bundle download for an offline depot',
    description: 'Offline depot only: the host running the VCF Download Tool fetches the upgrade bundles.',
    note: 'Offline depot only: keep while you download the upgrade bundles.',
    ref: 'https://knowledge.broadcom.com/external/article/327186',
  },
]

// When to close a 5.2 flow with no 9.x equivalent, per product line (first match wins).
const REMOVED_NOTES = [
  { test: r => isCloudBuilder(r), note: 'Cloud Builder is only used for the 5.x bring-up: not needed for the upgrade.' },
  { test: r => r.family === 'fleet', note: 'Keep while Aria Suite Lifecycle still manages Workspace ONE Access and drives the Aria upgrades, then decommission it.' },
  { test: r => r.family === 'identity', note: 'Keep until VCF Automation is switched to VCF Identity Broker (Day-2), then decommission Workspace ONE Access.' },
  { test: r => r.family === 'logs', note: 'Keep until the migration to Log Management is done and the legacy logs are no longer needed (90 days).' },
  { test: () => true, note: 'No equivalent in the VCF 9.x matrix: close once the upgrade is finished and validated.' },
]

// Hand-settled matches for rows the automatic matching gets wrong: { product, port, protocol, source,
// destination } of a 9.x row (exact strings) → { status, note }. Extend as rows are reviewed.
export const PORTS_UPGRADE_OVERRIDES = []

// ─── pitfalls shown above the comparison ───
export const PORTS_UPGRADE_NOTES = [
  {
    title: 'Upgrade path',
    text: 'VCF 5.0 / 5.1 must reach 5.2.x first. 5.2.0–5.2.3 can upgrade directly to 9.1. 5.2.4 cannot go to 9.1.0 (released after it); 5.2.4 → 9.1.1 is reported supported, check the Interoperability Matrix.',
    refs: [['KB 450972', 'https://knowledge.broadcom.com/external/article/450972'], ['TechDocs: Upgrading to VCF 9.1', 'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html']],
  },
  {
    title: 'Downloads leave from new IPs',
    text: 'In 9.1 the bundles are downloaded by the Software Depot of VCF Management Services, not by SDDC Manager: rules scoped to the SDDC Manager IP fail with HTTP 403. Allow eapi.broadcom.com, dl.broadcom.com, vvs.broadcom.com, vsanhealth.vmware.com (443), and vcf.packages.broadcom.com from 9.1.1.',
    refs: [['KB 443166', 'https://knowledge.broadcom.com/external/article/443166'], ['KB 443216', 'https://knowledge.broadcom.com/external/article/443216']],
  },
  {
    title: 'VCF Management Services + License Server',
    text: 'Mandatory in 9.1: plan 12 (minimum) to 30 IPs and five FQDNs with PTR records; the internal range 198.18.0.0/15 must not overlap anything routed. A VCF Operations cloud proxy must exist before the deployment.',
    refs: [['TechDocs: Deploy VCF Management Services', 'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/deploy-vcf-management-services.html']],
  },
  {
    title: 'Licensing',
    text: 'Connected mode: VCF Operations → eapi.broadcom.com and vcf.broadcom.com (443). vCenter → License Server (443).',
    refs: [['KB 431546', 'https://knowledge.broadcom.com/external/article/431546']],
  },
  {
    title: 'Syslog and identity',
    text: 'Point every log source to the new Log Management VIP, preferably over TLS (1514). VCF Identity Broker 9.1 also queries the AD Global Catalog (3268 / 3269). A VMware blog reports plain syslog 514 blocked during the 9.1 upgrade; the Broadcom matrix still lists 514.',
    refs: [['TechDocs: Upgrading to Log Management 9.1', 'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-operations-for-logs.html']],
  },
  {
    title: 'Data caveats',
    text: 'The VCF 5.2 side is built from the legacy product listings of ports.broadcom.com (no VCF 5.x mapping upstream). The Aria Automation and Aria Suite Lifecycle listings stop at 8.0 / 8.6 (5.2 ships 8.18), so their removed flows may be incomplete. Some "New in 9.x" rows are flows the 5.2 listings simply did not document (DNS, NTP, BGP…): check them against your current rules. Avi and vDefend follow their own release trains and are left out.',
    refs: [['ports.broadcom.com', 'https://ports.broadcom.com/']],
  },
]

// ─── diff ───
const portKey = r => `${r.port}|${r.protocol}`
const strictKey = r => `${portKey(r)}|${r._src}|${r._dst}`
const looseKey = r => `${portKey(r)}|${r.family}`
const prep = (r, family) => ({ ...r, family, _src: normPortsLabel(r.source), _dst: normPortsLabel(r.destination) })
const strip = ({ _src, _dst, ...r }) => r
const brief = r => ({ product: r.product, source: r.source, destination: r.destination, purpose: r.purpose })
const overrideKey = r => [r.product, r.port, r.protocol, r.source, r.destination].join('|')

const diffCache = new Map()
// Full comparison for one target bucket (no plan / internal / ICMP filtering), memoized: data is static.
function baseDiff(target) {
  if (diffCache.has(target)) return diffCache.get(target)
  const overrides = new Map(PORTS_UPGRADE_OVERRIDES.map(o => [overrideKey(o), o]))
  const old = PORTS_5X_DATA.map(r => prep(r, r.family))
  const neu = PORTS_DATA.filter(r => r.vcfVersions.includes(target) && PORTS_UPGRADE_FAMILY[r.product] !== null)
    .map(r => prep(r, PORTS_UPGRADE_FAMILY[r.product] || 'other'))

  const oldStrict = new Map(), oldLoose = new Map()
  for (const o of old) {
    if (isCloudBuilder(o)) continue
    if (!oldStrict.has(strictKey(o))) oldStrict.set(strictKey(o), [])
    oldStrict.get(strictKey(o)).push(o)
    if (!oldLoose.has(looseKey(o))) oldLoose.set(looseKey(o), [])
    oldLoose.get(looseKey(o)).push(o)
  }
  const used = new Set()
  const rows = []
  for (const r of neu) {
    let status, was, note, ref
    const same = oldStrict.get(strictKey(r))
    if (same) { status = 'unchanged'; same.forEach(o => used.add(o)) }
    else {
      const cands = oldLoose.get(looseKey(r)) || []
      const scored = cands.map(o => ({ o, s: jaccard(o._src, r._src), d: jaccard(o._dst, r._dst) }))
        .sort((a, b) => Math.min(b.s, b.d) - Math.min(a.s, a.d) || Math.max(b.s, b.d) - Math.max(a.s, a.d))
      const best = scored[0]
      // changed: one endpoint matches and the other one still shares a word (ESX → depot vs ESX → Trust
      // Authority is not a change of the same rule); review: some resemblance; no resemblance at all: added.
      if (best && Math.min(best.s, best.d) >= SIMILAR) { status = 'unchanged'; used.add(best.o) }
      else if (best && Math.max(best.s, best.d) >= SIMILAR && Math.min(best.s, best.d) > 0) { status = 'changed'; was = [brief(best.o)]; used.add(best.o) }
      else if (best && Math.max(best.s, best.d) >= REVIEW) {
        status = 'review'
        const near = scored.filter(x => Math.max(x.s, x.d) >= REVIEW).slice(0, 3)
        was = near.map(x => brief(x.o)); near.forEach(x => used.add(x.o))
      }
      else status = 'added'
    }
    const tr = PORTS_UPGRADE_TRANSIENT_RULES.find(t => t.test(r))
    if (tr) { status = 'transient'; was = undefined; note = tr.note; ref = tr.ref }
    const ov = overrides.get(overrideKey(r))
    if (ov) { status = ov.status; note = ov.note || note }
    rows.push({ status, ...strip(r), ...(was ? { was } : {}), ...(note ? { note } : {}), ...(ref ? { ref } : {}) })
  }
  for (const x of PORTS_UPGRADE_EXTRA) rows.push({ status: 'transient', vcfVersions: [...PORTS_UPGRADE_TARGETS], releases: [], ...x })
  for (const o of old) {
    if (used.has(o)) continue
    rows.push({ status: 'removed', ...strip(o), note: REMOVED_NOTES.find(n => n.test(o)).note })
  }
  diffCache.set(target, rows)
  return rows
}

// Comparison rows for the UI / MCP. onlyPlan keeps the 9.x rows of components in the plan (the 5.2 side
// describes what exists today and is always kept); internal / loopback flows and ICMP are hidden by default.
export function portsUpgradeDiff({ target = '9.1.1', form, sizing, onlyPlan = false, includeInternal = false, includeIcmp = false } = {}) {
  if (!PORTS_UPGRADE_TARGETS.includes(target)) throw new Error(`target must be one of ${PORTS_UPGRADE_TARGETS.join(', ')}`)
  const all = baseDiff(target)
  const rows = all.filter(r => {
    if (!includeInternal && isInternalFlow(r)) return false
    if (!includeIcmp && r.protocol === 'ICMP') return false
    if (onlyPlan && r.status !== 'removed' && r.vcfVersions && !portsProductInPlan(r.product, form, sizing)) return false
    return true
  })
  const counts = Object.fromEntries(PORTS_UPGRADE_STATUSES.map(s => [s.id, 0]))
  for (const r of rows) counts[r.status]++
  return { from: PORTS_UPGRADE_FROM, target, total: rows.length, counts, rows }
}
