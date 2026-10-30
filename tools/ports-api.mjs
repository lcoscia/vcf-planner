// Shared helpers for the ports.broadcom.com generators (tools/refresh_ports.mjs → core/ports.js,
// tools/refresh_ports_legacy.mjs → core/ports-5x.js): API access with retry / raw save / raw replay,
// and the row normalization both generated files share.
//
// The site is an Angular SPA backed by a public read-only JSON API (the X-ClientId below is the
// public client id shipped in the site's main.js). Node only — the planner never calls the API.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const API = 'https://ports.esp.spespg1.vmw.saas.broadcom.com/manage/view/v1/'
const CLIENT_ID = 'aed572517d2db4d2bb7fc504796972f4'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// GET API + path. fromRaw: read DIR/rawName instead; saveRaw: also write the response to DIR/rawName.
export async function api(path, rawName, { fromRaw, saveRaw } = {}) {
  if (fromRaw) return JSON.parse(await readFile(join(fromRaw, rawName), 'utf8'))
  let lastErr
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(API + path, { headers: { 'X-ClientId': CLIENT_ID, Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`)
      const data = await res.json()
      if (saveRaw) { await mkdir(saveRaw, { recursive: true }); await writeFile(join(saveRaw, rawName), JSON.stringify(data)) }
      return data
    } catch (e) { lastErr = e; await sleep(500 * 2 ** attempt) }
  }
  throw lastErr
}

// ─── normalization ───
export const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim()

export const liveRow = r => String(r.active) === 'true' && r.status === 'PUBLISHED'

export function normProtocols(p) {
  const u = clean(p).toUpperCase()
  if (!u) return ['TCP']
  const tokens = u.split(/[\s,/()]+|\bAND\b/).filter(Boolean)
  const hasTcp = tokens.includes('TCP'), hasUdp = tokens.includes('UDP')
  if (hasTcp && hasUdp) return ['TCP', 'UDP']
  if (tokens.includes('ICMP')) return ['ICMP']
  if (tokens.includes('ESP')) return ['ESP']
  if (hasUdp) return ['UDP']
  // TCP, HTTPS, HTTP, SSL, TLS, SOAP, LDAP(S), gRPC, CFAPI, NFS… all ride on TCP
  return ['TCP']
}

export function normDirection(c) {
  const u = clean(c).toLowerCase()
  if (/^(both|bi-?directional|inbound \+ outbound)$/.test(u)) return 'Bidirectional'
  if (/^(outbound|outgoing|outgong)/.test(u)) return 'Outbound'
  if (/^(inbound|incoming)/.test(u)) return 'Inbound'
  return 'Unspecified'
}

export function normPort(p) {
  const s = clean(p)
  const icmp = s.match(/^Type\s*(\d+)\s*,?\s*Code\s*(\d+)$/i)
  if (icmp) return `Type ${icmp[1]}, Code ${icmp[2]}`
  return s || 'N/A'
}

// Legacy listings often pack several ports in one field ("443, 9543, 16520, 22", "161 and 443",
// "44500 to 44502", "UDP 2055"): one entry per port / range. ICMP and free text stay as they are.
export function splitPorts(p) {
  const s = normPort(p)
  if (/^type\s/i.test(s) || !/\d/.test(s) || /^undefined$/i.test(s)) return [/^undefined$/i.test(s) ? 'N/A' : s]
  const parts = s.replace(/\b(tcp|udp)\b/gi, '').split(/\s*(?:,|;|\band\b)\s*/i).map(x => x.trim()).filter(Boolean)
  const out = parts.map(x => x.replace(/^(\d+)\s*(?:-|to)\s*(\d+)$/i, '$1-$2'))
  return out.every(x => /^\d+(-\d+)?$/.test(x)) ? [...new Set(out)] : [s]
}

export const releaseVersion = rel => {
  const m = `${rel.displayName || ''} ${rel.releaseName || ''}`.match(/\d+(?:\.\d+){1,3}/)
  if (!m) return clean(rel.displayName || rel.releaseName)
  const parts = m[0].split('.')
  while (parts.length > 3 && parts[parts.length - 1] === '0') parts.pop() // 9.1.0.0 → 9.1.0
  return parts.join('.')
}

// numeric ports first (by first number), then ICMP types / 'Any' / 'user-configurable'
export const firstPortNum = p => { const m = String(p).match(/^\d+/); return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER }

export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
export const verCmp = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d }
  return cmp(a, b)
}
