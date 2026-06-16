// Network validation — pure functions, transformed from the Alpine methods in
// index.html. Low-level field validators plus conflict primitives that operate on
// plain [{label, value}] lists, with form-walking wrappers used by the site. The
// MCP server calls the list primitives directly with caller-supplied data.

export function isValidIp(v) {
  if (!v) return true
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every(n => parseInt(n) <= 255)
}

export function isValidCidr(v) {
  if (!v) return true
  const parts = v.split('/')
  return parts.length === 2 && isValidIp(parts[0]) && parseInt(parts[1]) >= 0 && parseInt(parts[1]) <= 32
}

export function isFqdn(v) {
  if (!v) return true
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(v)
}

export function ipToInt(ip) {
  const p = ip.split('.').map(Number)
  return ((p[0]*256+p[1])*256+p[2])*256+p[3]
}

// ── Conflict primitives over [{label, value}] entries ──

// Duplicate VLAN IDs. entries: [{label, value}]
export function findVlanConflicts(entries) {
  const seen = {}; const warnings = []
  for (const { label, value } of entries) {
    if (value === undefined || value === null || value === '') continue
    const val = String(value)
    if (seen[val]) warnings.push(`VLAN ${val}: "${seen[val]}" and "${label}"`)
    else seen[val] = label
  }
  return warnings
}

// Duplicate IP addresses. entries: [{label, value}]
export function findIpConflicts(entries) {
  const seen = {}; const conflicts = []
  for (const { label, value } of entries) {
    if (!value || !isValidIp(value)) continue
    if (seen[value]) conflicts.push(`${value}: "${seen[value]}" and "${label}"`)
    else seen[value] = label
  }
  return conflicts
}

// Overlapping CIDR ranges. entries: [{label, value}]
export function findCidrOverlaps(entries) {
  const nets = []; const warnings = []
  for (const { label, value } of entries) {
    if (!value || !isValidCidr(value)) continue
    const [ip, prefix] = value.split('/')
    const p = parseInt(prefix)
    const ipInt = ipToInt(ip)
    const mask = p === 0 ? 0 : (~0 << (32-p)) >>> 0
    const net = (ipInt & mask) >>> 0
    nets.push({ label, cidr: value, net, mask })
  }
  for (let i=0; i<nets.length; i++) {
    for (let j=i+1; j<nets.length; j++) {
      const a = nets[i], b = nets[j]
      if (a.cidr === b.cidr) continue
      const overlap = ((a.net & b.mask)>>>0) === b.net || ((b.net & a.mask)>>>0) === a.net
      if (overlap) warnings.push(`${a.label} (${a.cidr}) overlaps ${b.label} (${b.cidr})`)
    }
  }
  return warnings
}

// ── Form-walking wrappers used by the site (index.html) ──
// They mirror the original behaviour: scan every field across allPages, read the
// form map, and delegate to the primitives above.

function collectFields(allPages, predicate, form) {
  const out = []
  for (const page of allPages) {
    for (const section of (page.sections || [])) {
      for (const field of (section.fields || [])) {
        if (predicate(field)) out.push({ label: field.label, value: form[field.key] })
      }
    }
  }
  return out
}

export function vlanWarnings(allPages, form) {
  return findVlanConflicts(collectFields(allPages, f => /Vlan$/i.test(f.key), form))
}

export function ipConflicts(allPages, form) {
  return findIpConflicts(collectFields(allPages, f => f.type === 'ip', form))
}

export function cidrOverlaps(allPages, form) {
  return findCidrOverlaps(collectFields(allPages, f => f.type === 'cidr', form))
}
