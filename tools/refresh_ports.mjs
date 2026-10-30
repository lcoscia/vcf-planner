#!/usr/bin/env node
// Regenerates core/ports.js from the Broadcom Ports and Protocols Tool (https://ports.broadcom.com/).
//
// The site is an Angular SPA backed by a public read-only JSON API (the X-ClientId below is the
// public client id shipped in the site's main.js). This script runs in Node only — the planner
// itself never calls the API (no CORS, works offline from the committed core/ports.js).
//
// Usage (Node 18+, no dependencies), from the repo root:
//   node tools/refresh_ports.mjs                 fetch + write core/ports.js
//   node tools/refresh_ports.mjs --dry-run       fetch + print the summary, write nothing
//   node tools/refresh_ports.mjs --report        also list source/destination labels with no PORTS_ENDPOINT_MAP entry
//   node tools/refresh_ports.mjs --save-raw DIR  keep the raw API responses in DIR (offline replay)
//   node tools/refresh_ports.mjs --from-raw DIR  rebuild from a previous --save-raw instead of the API
//   node tools/refresh_ports.mjs --force         skip the "row count dropped > 20 %" guard
//
// Version buckets (row.vcfVersions):
//   - the API maps each product release to a VCF version (vcfproductreleasemappings: 9.0 / 9.1);
//     releases whose own version is 9.1.1 go to the '9.1.1' bucket;
//   - Broadcom only tags the rows that changed with 9.1.1, so 9.1.1 is cumulative: every 9.1 row
//     is also a 9.1.1 row;
//   - Avi Load Balancer and VMware vDefend have their own release trains (32.x / 5.x) that the tool
//     only maps to VCF 9.1; their flows are version-independent of VCF, so they get all buckets;
//   - releases with no VCF mapping (e.g. SaaS editions) are ignored.

import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  API, api as apiGet, clean, normProtocols, normDirection, normPort, releaseVersion, firstPortNum, cmp, verCmp,
} from './ports-api.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'core', 'ports.js')
const BUCKETS = ['9.0', '9.1', '9.1.1']
const DECOUPLED = new Set(['Avi Load Balancer', 'VMware vDefend'])
const MUST_HAVE = ['Avi Load Balancer', 'VMware vDefend']

const args = process.argv.slice(2)
const flag = n => args.includes(n)
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const DRY = flag('--dry-run'), REPORT = flag('--report'), FORCE = flag('--force')
const SAVE_RAW = opt('--save-raw'), FROM_RAW = opt('--from-raw')

const api = (path, rawName) => apiGet(path, rawName, { fromRaw: FROM_RAW, saveRaw: SAVE_RAW })

// ─── main ───
const products = (await api('vmwareproducts', 'products.json')).filter(p => p.vcfFlag && p.active !== false)
const mappings = await api('vcfproductreleasemappings', 'mappings.json')
const vcfOf = new Map() // release id → bucket
for (const m of mappings) {
  if (m.active === false || !m.release) continue
  const vcf = typeof m.vcfVersion === 'object' ? m.vcfVersion?.vcfVersion : m.vcfVersion
  const relVer = clean(m.release.displayName)
  const bucket = relVer.startsWith('9.1.1') ? '9.1.1' : vcf === '9.0' ? '9.0' : vcf === '9.1' ? '9.1' : null
  if (bucket) vcfOf.set(m.release.id, { bucket, version: releaseVersion(m.release) })
}

const merged = new Map()
const perProduct = {}
const skippedUnmapped = {}
for (const p of products) {
  const name = clean(p.displayName)
  const rows = await api(`vmwareproducts/${p.id}/listings1`, `l_${p.id}.json`)
  perProduct[name] = 0
  for (const r of rows) {
    if (String(r.active) !== 'true' || r.status !== 'PUBLISHED') continue
    const buckets = new Set(), releases = new Set()
    for (const rel of r.releases || []) {
      const m = vcfOf.get(rel.id)
      if (!m) continue
      buckets.add(m.bucket); releases.add(m.version)
    }
    if (!buckets.size) { skippedUnmapped[name] = (skippedUnmapped[name] || 0) + 1; continue }
    if (buckets.has('9.1')) buckets.add('9.1.1')
    if (DECOUPLED.has(name)) BUCKETS.forEach(b => buckets.add(b))
    for (const protocol of normProtocols(r.protocol)) {
      const row = {
        product: name,
        port: normPort(r.port),
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
        buckets.forEach(b => prev._b.add(b)); releases.forEach(v => prev._r.add(v))
        if (!prev.description && row.description) prev.description = row.description
      } else {
        merged.set(key, { ...row, _b: new Set(buckets), _r: new Set(releases) })
      }
    }
  }
}

const data = [...merged.values()].map(({ _b, _r, ...row }) => ({
  ...row,
  vcfVersions: BUCKETS.filter(b => _b.has(b)),
  releases: [..._r].sort(verCmp),
})).sort((a, b) =>
  cmp(a.product, b.product) || firstPortNum(a.port) - firstPortNum(b.port) || cmp(a.port, b.port) ||
  cmp(a.protocol, b.protocol) || cmp(a.source, b.source) || cmp(a.destination, b.destination) ||
  cmp(a.direction, b.direction) || cmp(a.purpose, b.purpose))

for (const row of data) perProduct[row.product] = (perProduct[row.product] || 0) + 1
const perBucket = Object.fromEntries(BUCKETS.map(b => [b, data.filter(r => r.vcfVersions.includes(b)).length]))

// ─── summary ───
console.log(`Products (vcfFlag): ${products.length}   rows: ${data.length}`)
console.log('Per VCF version:', perBucket)
for (const [k, v] of Object.entries(perProduct).sort()) console.log(`  ${String(v).padStart(4)}  ${k}`)
if (Object.keys(skippedUnmapped).length) console.log('Rows skipped (release not mapped to a VCF version):', skippedUnmapped)

// ─── guards: never overwrite core/ports.js with a broken extract ───
const errors = []
for (const b of BUCKETS) if (!perBucket[b]) errors.push(`no row for VCF ${b}`)
for (const prod of MUST_HAVE) for (const b of BUCKETS) {
  if (!data.some(r => r.product === prod && r.vcfVersions.includes(b))) errors.push(`${prod} has no row for VCF ${b}`)
}
let previous = []
if (existsSync(OUT)) {
  try { previous = (await import(pathToFileURL(OUT).href + `?t=${Date.now()}`)).PORTS_DATA || [] } catch { previous = [] }
}
const prevProducts = new Set(previous.map(r => r.product))
for (const prod of prevProducts) if (!perProduct[prod]) errors.push(`${prod} disappeared (was in the previous core/ports.js)`)
const prev91 = previous.filter(r => !r.vcfVersions || r.vcfVersions.includes('9.1')).length
if (!FORCE && prev91 && perBucket['9.1'] < prev91 * 0.8) errors.push(`VCF 9.1 rows dropped from ${prev91} to ${perBucket['9.1']} (> 20 %) — rerun with --force if expected`)

const { PORTS_CATEGORY_MAP, PORTS_PLAN_PREDICATES, portsEndpointSpecs } = await import(pathToFileURL(join(ROOT, 'core', 'ports-meta.js')).href)
for (const prod of Object.keys(perProduct)) {
  if (!perProduct[prod]) continue
  if (!PORTS_CATEGORY_MAP[prod]) console.warn(`WARN: "${prod}" has no PORTS_CATEGORY_MAP entry (shown under "Other")`)
  if (!PORTS_PLAN_PREDICATES[prod]) console.warn(`WARN: "${prod}" has no PORTS_PLAN_PREDICATES entry (always shown)`)
}

if (REPORT) {
  const missing = new Map()
  for (const r of data) for (const label of [r.source, r.destination]) {
    if (!portsEndpointSpecs(label)) missing.set(label, (missing.get(label) || 0) + 1)
  }
  console.log(`\nLabels with no PORTS_ENDPOINT_MAP entry (${missing.size}):`)
  for (const [label, n] of [...missing].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${label}`)
}

if (errors.length) {
  console.error('\nABORT — core/ports.js left untouched:\n  - ' + errors.join('\n  - '))
  process.exit(1)
}
if (DRY) { console.log('\n--dry-run: nothing written.'); process.exit(0) }

const today = new Date().toISOString().slice(0, 10)
const header = `// VCF 9.x Ports & Protocols matrix — GENERATED by tools/refresh_ports.mjs, do not edit by hand.
// Source: Broadcom Ports and Protocols Tool (https://ports.broadcom.com/), API ${API}, fetched ${today}.
// ${data.length} rows / ${Object.values(perProduct).filter(Boolean).length} components — per VCF version: ${BUCKETS.map(b => `${b}: ${perBucket[b]}`).join(', ')}.
// Each entry: { product, port, protocol, source, destination, direction, purpose, description, vcfVersions, releases }
//   direction ∈ Inbound | Outbound | Bidirectional | Unspecified; protocol ∈ TCP | UDP | ICMP | ESP;
//   vcfVersions ⊆ ${JSON.stringify(BUCKETS)} (9.1.1 is cumulative over 9.1); releases = the product's own release numbers.
export const PORTS_DATA = [
`
await writeFile(OUT, header + data.map(r => JSON.stringify(r) + ',').join('\n') + '\n]\n')
console.log(`\nWrote ${OUT}`)
