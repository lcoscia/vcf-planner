#!/usr/bin/env node
// Regenerates core/ports-5x.js — the VCF 5.2 side of the "Upgrade from VCF 5.2" comparison in the
// Ports & Protocols page — from the Broadcom Ports and Protocols Tool (https://ports.broadcom.com/).
//
// Unlike VCF 9.x, the API has NO VCF 5.x → component release mapping (vcfversions only lists 9.0 / 9.1),
// so the VCF 5.2 bill of materials below is hand-maintained: legacy product id → the release(s) whose
// rows describe what a VCF 5.2 environment runs. Some listings are stale upstream (Aria Automation and
// Aria Suite Lifecycle stop before 8.18): the closest published release is used and flagged in `note`.
//
// Usage (Node 18+, no dependencies), from the repo root:
//   node tools/refresh_ports_legacy.mjs                 fetch + write core/ports-5x.js
//   node tools/refresh_ports_legacy.mjs --dry-run       fetch + print the summary, write nothing
//   node tools/refresh_ports_legacy.mjs --save-raw DIR  keep the raw API responses in DIR (offline replay)
//   node tools/refresh_ports_legacy.mjs --from-raw DIR  rebuild from a previous --save-raw instead of the API
//
// Each row carries `family`, the product line it belongs to across the 5.x → 9.x renames
// (see PORTS_UPGRADE_FAMILY in core/ports-upgrade.js for the 9.x side).

import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  API, api as apiGet, clean, liveRow, normProtocols, normDirection, splitPorts, firstPortNum, cmp, verCmp,
} from './ports-api.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'core', 'ports-5x.js')

// VCF 5.2 BOM (5.2 / 5.2.1 release notes): legacy product id → family, releases used, expected display name.
const BOM_52 = [
  { id: '5e42d27b23a0e6000e599ddd', name: 'VMware Cloud Foundation', family: 'sddc', releases: ['5.2', '5.2.1'], note: 'SDDC Manager + Cloud Builder' },
  { id: '5ce6ae87c4c4bb0018ec6bf3', name: 'vSphere', family: 'vsphere', releases: ['8.0'], note: 'vCenter + ESXi 8.0 U3' },
  { id: '5ce6aeadc4c4bb0018ec6bf5', name: 'vSAN', family: 'vsan', releases: ['8.0'] },
  { id: '5e562058f2e8d500177fc23e', name: 'NSX', family: 'nsx', releases: ['4.2', '4.2.x'] },
  { id: '6405a015eaa6a73817d9c82d', name: 'VMware Aria Operations', family: 'ops', releases: ['8.18'] },
  { id: '64343853eaa6a73817d9c889', name: 'VMware Aria Operations for Logs', family: 'logs', releases: ['8.18'] },
  { id: '645cf2daeaa6a73817d9c8e8', name: 'VMware Aria Automation', family: 'automation', releases: ['8.0'], note: 'latest published listing is 8.0 (BOM ships 8.18)' },
  { id: '5dcbd881bba3080013417494', name: 'VMware Aria Suite Lifecycle', family: 'fleet', releases: ['8.6'], note: 'latest published listing is 8.6 (BOM ships 8.18)' },
  { id: '5d975c7d9e32b9001601d90e', name: 'Workspace ONE Access', family: 'identity', releases: ['22.09'], note: '22.09 = 3.3.7' },
  { id: '5d82589c8e3b97001626bac8', name: 'HCX', family: 'hcx', releases: ['4.11'] },
  { id: '6a211d674e349d6d9c172485', name: 'VMware Aria Operations for Networks', family: 'opsnet', releases: ['6.13', '6.14'] },
  { id: '64638d79c3f9fc6c492d90e4', name: 'vSphere Replication', family: 'vr', releases: ['8.8'] },
]

const args = process.argv.slice(2)
const flag = n => args.includes(n)
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const DRY = flag('--dry-run')
const SAVE_RAW = opt('--save-raw'), FROM_RAW = opt('--from-raw')
const api = (path, rawName) => apiGet(path, rawName, { fromRaw: FROM_RAW, saveRaw: SAVE_RAW })

// ─── main ───
const products = await api('vmwareproducts', 'products.json')
const errors = []
const merged = new Map()
const perProduct = {}
for (const bom of BOM_52) {
  const p = products.find(x => x.id === bom.id)
  if (!p) { errors.push(`${bom.name} (${bom.id}) not found in vmwareproducts`); continue }
  if (clean(p.displayName) !== bom.name) console.warn(`WARN: ${bom.id} is now "${clean(p.displayName)}" (expected "${bom.name}")`)
  perProduct[bom.name] = 0
  for (const r of await api(`vmwareproducts/${p.id}/listings1`, `l_${p.id}.json`)) {
    if (!liveRow(r)) continue
    const releases = (r.releases || []).map(x => clean(x.displayName)).filter(x => bom.releases.includes(x))
    if (!releases.length) continue
    for (const protocol of normProtocols(r.protocol)) for (const port of splitPorts(r.port)) {
      const row = {
        product: bom.name,
        family: bom.family,
        port,
        protocol,
        source: clean(r.source),
        destination: clean(r.destination),
        direction: normDirection(r.classification),
        purpose: clean(r.purpose),
        description: clean(r.serviceDescription),
      }
      const key = [row.product, row.port, row.protocol, row.source, row.destination, row.direction, row.purpose].join('|')
      const prev = merged.get(key)
      if (prev) {
        releases.forEach(v => prev._r.add(v))
        if (!prev.description && row.description) prev.description = row.description
      } else {
        merged.set(key, { ...row, _r: new Set(releases) })
      }
    }
  }
}

const data = [...merged.values()].map(({ _r, ...row }) => ({ ...row, releases: [..._r].sort(verCmp) }))
  .sort((a, b) =>
    cmp(a.product, b.product) || firstPortNum(a.port) - firstPortNum(b.port) || cmp(a.port, b.port) ||
    cmp(a.protocol, b.protocol) || cmp(a.source, b.source) || cmp(a.destination, b.destination) ||
    cmp(a.direction, b.direction) || cmp(a.purpose, b.purpose))
for (const row of data) perProduct[row.product]++

console.log(`VCF 5.2 BOM: ${BOM_52.length} products   rows: ${data.length}`)
for (const b of BOM_52) console.log(`  ${String(perProduct[b.name] ?? 0).padStart(4)}  ${b.name} ${b.releases.join('/')}${b.note ? ` (${b.note})` : ''}`)

for (const b of BOM_52) if (perProduct[b.name] === 0) errors.push(`${b.name} has no row for release ${b.releases.join('/')}`)
if (errors.length) {
  console.error('\nABORT — core/ports-5x.js left untouched:\n  - ' + errors.join('\n  - '))
  process.exit(1)
}
if (DRY) { console.log('\n--dry-run: nothing written.'); process.exit(0) }

const today = new Date().toISOString().slice(0, 10)
const bom = BOM_52.map(({ name, family, releases, note }) => ({ product: name, family, releases, ...(note ? { note } : {}) }))
const header = `// VCF 5.2 Ports & Protocols (the "from" side of the VCF 5.2 → 9.x upgrade comparison) —
// GENERATED by tools/refresh_ports_legacy.mjs, do not edit by hand.
// Source: Broadcom Ports and Protocols Tool (https://ports.broadcom.com/), API ${API}, fetched ${today}.
// ${data.length} rows / ${BOM_52.length} products. The API has no VCF 5.x mapping: PORTS_5X_BOM is the hand-maintained
// VCF 5.2 bill of materials (product → releases) the rows were selected with.
// Each entry: { product, family, port, protocol, source, destination, direction, purpose, description, releases }
export const PORTS_5X_BOM = ${JSON.stringify(bom, null, 1).replace(/\n\s*/g, ' ')}
export const PORTS_5X_DATA = [
`
await writeFile(OUT, header + data.map(r => JSON.stringify(r) + ',').join('\n') + '\n]\n')
console.log(`\nWrote ${OUT}`)
