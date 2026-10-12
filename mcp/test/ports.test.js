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
