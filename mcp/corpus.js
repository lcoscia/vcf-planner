// corpus.js — builds one flat, searchable corpus from the shared core data so the
// ChatGPT Deep Research `search`/`fetch` tools (and any keyword lookups) have a single
// index to query. Everything is derived from ../core — never duplicated.
import { PORTS_DATA, PREREQ_DATA, LT, ALL_PAGES } from '../core/index.js'

const SITE = 'https://vcfplanning.lcoscia.fr/#'

// --- helpers -----------------------------------------------------------------

const isSpec = (o) =>
  o && typeof o === 'object' && ('vcpu' in o || 'ram' in o || 'disk' in o)

// Classify an LT entry so we can render it as readable text in the corpus.
// FLAT  -> a single {vcpu,ram,disk} spec
// TIERED-> a map of sizeName -> {vcpu,ram,disk}
// other -> scalar / nested numbers, rendered generically
function describeComponent(key, value) {
  if (value == null || typeof value !== 'object') {
    return `${key}: ${value}`
  }
  if (isSpec(value)) {
    return `${key} — vCPU ${value.vcpu ?? 0}, RAM ${value.ram ?? 0} GB, Disk ${value.disk ?? 0} GB`
  }
  const keys = Object.keys(value)
  if (keys.length && isSpec(value[keys[0]])) {
    const tiers = keys
      .map((t) => {
        const s = value[t]
        return `${t} (vCPU ${s.vcpu ?? 0}, RAM ${s.ram ?? 0} GB, Disk ${s.disk ?? 0} GB)`
      })
      .join('; ')
    return `${key} sizes: ${tiers}`
  }
  // scalar map or nested numbers
  return `${key}: ${JSON.stringify(value)}`
}

function entry(id, title, text, metadata = {}) {
  return { id, title, text: String(text), url: `${SITE}${id}`, metadata }
}

// --- corpus build ------------------------------------------------------------

function buildCorpus() {
  const corpus = []

  // Ports & protocols
  PORTS_DATA.forEach((p, i) => {
    const title = `${p.product} — ${p.protocol} ${p.port} (${p.direction})`
    const text = [
      `Product: ${p.product}`,
      `Port: ${p.port}/${p.protocol}`,
      `Direction: ${p.direction}`,
      `Source: ${p.source}`,
      `Destination: ${p.destination}`,
      `Purpose: ${p.purpose}`,
      p.description || '',
    ]
      .filter(Boolean)
      .join('\n')
    corpus.push(entry(`port:${i}`, title, text, { kind: 'port', ...p }))
  })

  // Prerequisites (one corpus entry per row, grouped by category title)
  PREREQ_DATA.forEach((group, gi) => {
    ;(group.rows || []).forEach((row, ri) => {
      const title = `${group.title}: ${row.component}`
      const text = [
        `Category: ${group.title}`,
        `Component: ${row.component}`,
        row.requirement ? `Requirement: ${row.requirement}` : '',
        row.notes ? `Notes: ${row.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      corpus.push(
        entry(`prereq:${gi}.${ri}`, title, text, {
          kind: 'prerequisite',
          category: group.title,
          ...row,
        }),
      )
    })
  })

  // Component specs (LT)
  Object.entries(LT).forEach(([key, value]) => {
    const text = describeComponent(key, value)
    corpus.push(
      entry(`component:${key}`, `Component spec: ${key}`, text, {
        kind: 'component',
        component_key: key,
      }),
    )
  })

  // Planning fields (ALL_PAGES -> sections -> fields)
  ALL_PAGES.forEach((page) => {
    ;(page.sections || []).forEach((section) => {
      ;(section.fields || []).forEach((field) => {
        const title = `${field.label || field.key} (${page.title} › ${section.title})`
        const text = [
          `Field: ${field.label || field.key} [${field.key}]`,
          `Page: ${page.title}`,
          `Section: ${section.title}`,
          field.type ? `Type: ${field.type}` : '',
          field.sample !== undefined ? `Sample: ${field.sample}` : '',
          field.required ? 'Required: yes' : '',
          field.notes ? `Notes: ${field.notes}` : '',
          Array.isArray(field.options) ? `Options: ${field.options.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
        corpus.push(
          entry(`field:${field.key}`, title, text, {
            kind: 'field',
            page: page.id,
            section: section.title,
            ...field,
          }),
        )
      })
    })
  })

  return corpus
}

export const CORPUS = buildCorpus()

// Fast lookup by id.
const BY_ID = new Map(CORPUS.map((d) => [d.id, d]))

export function getById(id) {
  return BY_ID.get(id) || null
}

// --- search ------------------------------------------------------------------

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean)
}

// Case-insensitive token match over title+text, ranked by number of matched
// tokens (title matches weighted higher), capped at ~25 results.
export function searchCorpus(query, cap = 25) {
  const tokens = tokenize(query)
  if (!tokens.length) return CORPUS.slice(0, cap)

  const scored = []
  for (const doc of CORPUS) {
    const title = doc.title.toLowerCase()
    const text = doc.text.toLowerCase()
    let score = 0
    for (const tok of tokens) {
      if (title.includes(tok)) score += 3
      if (text.includes(tok)) score += 1
    }
    if (score > 0) scored.push({ doc, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, cap).map((s) => s.doc)
}
