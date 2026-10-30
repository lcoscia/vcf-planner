// Integrity checks for the generated Ports & Protocols matrix (core/ports.js, built by
// tools/refresh_ports.mjs from ports.broadcom.com) and its metadata (core/ports-meta.js).
// Run: node --test mcp/test/ports.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_DATA } from '../../core/ports.js'
import {
  PORTS_VCF_VERSIONS, PORTS_CATEGORY_MAP, PORTS_PLAN_PREDICATES, PORTS_ENDPOINT_MAP,
  portsVersionForPlan, portsProductInPlan, resolvePortsEndpoint,
} from '../../core/ports-meta.js'
import { ALL_PAGES } from '../../core/reference.js'

const DIRECTIONS = ['Inbound', 'Outbound', 'Bidirectional', 'Unspecified']
const PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'ESP']
const products = [...new Set(PORTS_DATA.map(r => r.product))]

test('every row is complete and normalized', () => {
  assert.ok(PORTS_DATA.length > 1000)
  for (const r of PORTS_DATA) {
    for (const k of ['product', 'port', 'protocol', 'source', 'destination', 'direction', 'purpose']) {
      assert.equal(typeof r[k], 'string', `${k} in ${JSON.stringify(r)}`)
    }
    assert.ok(DIRECTIONS.includes(r.direction), r.direction)
    assert.ok(PROTOCOLS.includes(r.protocol), r.protocol)
    assert.ok(Array.isArray(r.vcfVersions) && r.vcfVersions.length, 'vcfVersions')
    assert.ok(r.vcfVersions.every(v => PORTS_VCF_VERSIONS.includes(v)), r.vcfVersions.join())
    assert.ok(Array.isArray(r.releases))
  }
})

test('9.1.1 is cumulative over 9.1', () => {
  for (const r of PORTS_DATA) if (r.vcfVersions.includes('9.1')) assert.ok(r.vcfVersions.includes('9.1.1'))
})

test('no duplicate rows', () => {
  const keys = PORTS_DATA.map(r => [r.product, r.port, r.protocol, r.source, r.destination, r.direction, r.purpose].join('|'))
  assert.equal(new Set(keys).size, keys.length)
})

test('every VCF version has flows, incl. Avi Load Balancer and VMware vDefend', () => {
  for (const v of PORTS_VCF_VERSIONS) {
    for (const prod of ['Avi Load Balancer', 'VMware vDefend', 'vCenter', 'ESX', 'NSX', 'SDDC Manager', 'VCF Operations']) {
      assert.ok(PORTS_DATA.some(r => r.product === prod && r.vcfVersions.includes(v)), `${prod} @ ${v}`)
    }
  }
  assert.ok(PORTS_DATA.some(r => r.product === 'VCF Operations Fleet Manager' && r.vcfVersions.includes('9.0')))
})

test('every product has a category and a plan predicate', () => {
  for (const p of products) {
    assert.ok(PORTS_CATEGORY_MAP[p], `category for ${p}`)
    assert.ok(PORTS_PLAN_PREDICATES[p], `predicate for ${p}`)
  }
})

test('endpoint map only references existing form keys', () => {
  const keys = new Set(ALL_PAGES.flatMap(pg => (pg.sections || []).flatMap(s => (s.fields || []).map(f => f.key))))
  assert.ok(keys.size > 500, 'form schema walked')
  for (const [label, specs] of Object.entries(PORTS_ENDPOINT_MAP)) {
    for (const spec of specs) {
      if (spec.hosts) { assert.ok(keys.has(`${spec.hosts}Host1Fqdn`), `${label}: ${spec.hosts}`); continue }
      const used = [spec.fqdnKey, spec.ipKey, spec.rangeStartKey, spec.rangeEndKey].filter(Boolean)
      assert.ok(used.length, `${label} / ${spec.label}: no key`)
      for (const k of used) assert.ok(keys.has(k), `${label} / ${spec.label}: unknown form key ${k}`)
    }
  }
})

test('plan helpers', () => {
  assert.equal(portsVersionForPlan('9.1.1.0'), '9.1.1')
  assert.equal(portsVersionForPlan('9.1.0.0'), '9.1')
  assert.equal(portsVersionForPlan('9.0.2.0'), '9.0')
  assert.equal(portsVersionForPlan(''), '9.1.1')
  assert.equal(portsProductInPlan('Avi Load Balancer', { aviInclude: 'Exclude' }), false)
  assert.equal(portsProductInPlan('Avi Load Balancer', { aviInclude: 'Include' }), true)
  assert.equal(portsProductInPlan('VMware vDefend', {}, { components: { ssp: true } }), true)
  assert.equal(portsProductInPlan('VMware vDefend', {}, { components: { ssp: false } }), false)
  assert.equal(portsProductInPlan('vCenter', {}), true)
  const avi = resolvePortsEndpoint('Avi Controller', { aviInclude: 'Include', aviClusterFqdn: 'avi.x', aviClusterIp: '10.0.0.1', aviCtrl1Fqdn: 'a1.x' })
  assert.deepEqual(avi.map(e => e.label), ['AVI Cluster VIP', 'AVI Controller 1'])
  const nsx = resolvePortsEndpoint('NSX Manager', { nsxMgr1Fqdn: 'n1.x', nsxMgr1Ip: '10.0.0.11' })
  assert.deepEqual(nsx, [{ label: 'NSX Manager Node 1', fqdn: 'n1.x', ip: '10.0.0.11' }])
})

test('MCP search_ports_protocols filters by vcfVersion', async (t) => {
  let registerTools
  try { ({ registerTools } = await import('../tools.js')) } catch { t.skip('MCP deps not installed (cd mcp && npm ci)'); return }
  const handlers = {}
  registerTools({ registerTool: (name, _def, fn) => { handlers[name] = fn } })
  const call = async args => JSON.parse((await handlers.search_ports_protocols(args)).content[0].text)
  const r90 = await call({ vcfVersion: '9.0', product: 'Fleet Manager', limit: 500 })
  assert.ok(r90.total > 0)
  const r91 = await call({ vcfVersion: '9.1', product: 'Fleet Manager', limit: 500 })
  assert.equal(r91.total, 0)
  const avi = await call({ vcfVersion: '9.1.1', product: 'avi', limit: 1 })
  assert.ok(avi.total > 0 && avi.results[0].vcfVersions.includes('9.1.1'))
})

// ─── VCF 5.2 → 9.x upgrade comparison (core/ports-5x.js, built by tools/refresh_ports_legacy.mjs) ───
import { PORTS_5X_DATA, PORTS_5X_BOM } from '../../core/ports-5x.js'
import {
  PORTS_UPGRADE_TARGETS, PORTS_UPGRADE_STATUSES, PORTS_UPGRADE_FAMILY, PORTS_UPGRADE_NOTES, portsUpgradeDiff, normPortsLabel,
} from '../../core/ports-upgrade.js'

test('VCF 5.2 rows are complete and belong to the BOM', () => {
  assert.ok(PORTS_5X_DATA.length > 500)
  const bom = new Map(PORTS_5X_BOM.map(b => [b.product, b]))
  for (const r of PORTS_5X_DATA) {
    for (const k of ['product', 'family', 'port', 'protocol', 'source', 'destination', 'direction', 'purpose']) {
      assert.equal(typeof r[k], 'string', `${k} in ${JSON.stringify(r)}`)
    }
    assert.ok(DIRECTIONS.includes(r.direction), r.direction)
    assert.ok(PROTOCOLS.includes(r.protocol), r.protocol)
    if (r.protocol !== 'ICMP') assert.ok(!/[,;]/.test(r.port), `multi-port field not split: ${r.port}`)
    const b = bom.get(r.product)
    assert.ok(b, `${r.product} not in PORTS_5X_BOM`)
    assert.equal(r.family, b.family)
    assert.ok(r.releases.length && r.releases.every(v => b.releases.includes(v)), `${r.product} ${r.releases}`)
  }
  for (const b of PORTS_5X_BOM) assert.ok(PORTS_5X_DATA.some(r => r.product === b.product), `${b.product} has no row`)
})

test('every 9.x product has an upgrade family, shared with the 5.2 side', () => {
  const families = new Set(PORTS_5X_BOM.map(b => b.family))
  for (const p of products) assert.ok(p in PORTS_UPGRADE_FAMILY, `${p} missing in PORTS_UPGRADE_FAMILY`)
  for (const p of ['SDDC Manager', 'vCenter', 'ESX', 'NSX', 'VCF Operations', 'Log Management', 'Identity Broker']) {
    assert.ok(families.has(PORTS_UPGRADE_FAMILY[p]), `${p} family has no 5.2 counterpart`)
  }
})

test('label normalization folds the 5.x → 9.x renames', () => {
  assert.equal(normPortsLabel('vRealize Operations Manager (Cluster and Nodes)'), normPortsLabel('VCF Operations'))
  assert.equal(normPortsLabel('ESXi Hosts for Management/Workload Domains'), normPortsLabel('ESX Management IP addresses'))
  assert.equal(normPortsLabel('DNS Server(s)'), normPortsLabel('DNS Resolvers'))
  assert.equal(normPortsLabel('Workspace ONE Access'), normPortsLabel('VCF Identity Broker'))
})

test('upgrade diff: statuses, counts and well-known flows', () => {
  const ids = PORTS_UPGRADE_STATUSES.map(s => s.id)
  for (const target of PORTS_UPGRADE_TARGETS) {
    const d = portsUpgradeDiff({ target })
    assert.equal(d.from, '5.2')
    assert.equal(d.total, d.rows.length)
    assert.equal(Object.values(d.counts).reduce((a, b) => a + b, 0), d.total)
    for (const r of d.rows) {
      assert.ok(ids.includes(r.status), r.status)
      if (r.status === 'removed') assert.ok(r.note, 'removed rows carry a when-to-close note')
      if (r.status === 'transient') assert.ok(r.note, 'transient rows carry a reason')
      if (r.status === 'changed') assert.equal(r.was.length, 1)
      assert.notEqual(r.protocol, 'ICMP')
      assert.ok(!/loopback/i.test(r.source + r.destination))
    }
    for (const id of ['added', 'changed', 'transient', 'removed', 'unchanged']) assert.ok(d.counts[id] > 0, `${target}: no ${id} row`)
    const find = (st, f) => d.rows.some(r => r.status === st && f(r))
    assert.ok(find('added', r => r.product === 'VCF Management Services' && r.port === '6443'), 'VCF Management Services 6443 is new')
    assert.ok(find('transient', r => r.port === '9543' && /legacy log insight/i.test(r.destination)), 'legacy LI migration is transient')
    assert.ok(find('removed', r => r.product === 'Workspace ONE Access'), 'Workspace ONE Access flows are removed')
    assert.ok(!d.rows.some(r => r.product === 'Avi Load Balancer' || r.product === 'VMware vDefend'), 'decoupled products left out')
  }
  assert.throws(() => portsUpgradeDiff({ target: '9.0' }))
  const withIcmp = portsUpgradeDiff({ target: '9.1.1', includeIcmp: true, includeInternal: true })
  assert.ok(withIcmp.total > portsUpgradeDiff({ target: '9.1.1' }).total)
  assert.ok(PORTS_UPGRADE_NOTES.every(n => n.title && n.text && n.refs.length))
})

test('upgrade diff: "only components in my plan" hides 9.x add-ons, keeps the 5.2 side', () => {
  const all = portsUpgradeDiff({ target: '9.1.1' })
  const plan = portsUpgradeDiff({ target: '9.1.1', onlyPlan: true, form: {}, sizing: {} })
  assert.ok(plan.total < all.total)
  assert.ok(!plan.rows.some(r => r.product === 'DSM Data Services'))
  assert.equal(plan.counts.removed, all.counts.removed)
})

test('MCP compare_ports_upgrade', async (t) => {
  let registerTools
  try { ({ registerTools } = await import('../tools.js')) } catch { t.skip('MCP deps not installed (cd mcp && npm ci)'); return }
  const handlers = {}
  registerTools({ registerTool: (name, _def, fn) => { handlers[name] = fn } })
  const call = async args => JSON.parse((await handlers.compare_ports_upgrade(args)).content[0].text)
  const def = await call({})
  assert.equal(def.target, '9.1.1')
  assert.ok(def.total > 0 && !def.results.some(r => r.status === 'unchanged'))
  assert.ok(def.notes.length && def.notes[0].refs[0].url)
  const vcfms = await call({ targetVersion: '9.1', status: ['added'], product: 'Management Services', port: 6443 })
  assert.ok(vcfms.total > 0 && vcfms.results.every(r => r.status === 'added' && r.port === '6443'))
})
