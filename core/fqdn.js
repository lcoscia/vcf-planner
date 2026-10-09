// FQDN auto-proposal — builds every FQDN of the plan from the Region / Site Code,
// the Instance Name and the DNS Domain Name, following the naming used by the
// Broadcom VCF 9.1 Planning & Preparation Workbook samples (25-Jun-2026 revision):
//   instance-level components  <site>-<instance>-<role>NN.<site>.<domain>   e.g. sfo-m01-vc01.sfo.rainpole.io
//   instance services          <site>-<role>NN.<site>.<domain>              e.g. sfo-vcf01 (SDDC Manager), sfo-ic01, sfo-sr01, sfo-cp01
//   fleet-level components     flt-<role>NN.<domain>                        e.g. flt-ops01a, flt-fc01, flt-logs01, flt-auto01
//   ESXi hosts                 <site>0<az>-<instance>-r01-esxNN.<site>.<domain>  e.g. sfo01-m01-r01-esx01 (AZ1), sfo02-m01-r01-esx01 (AZ2)
// Pure module (no DOM/Alpine): the website calls applyFqdnProposals() on every save.
import { ALL_PAGES, isVmsc, isVsanStretched } from './reference.js'

const clean = v => String(v || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '')
const pad2 = n => String(n).padStart(2, '0')
const cnt = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : d }

// Returns { key: fqdn } for every field the plan can propose, or {} when the
// site code or the DNS domain is missing.
export function proposeFqdns(f, auto = f._fqdnAuto || {}) {
  const site = clean(f.deploymentRegion || f.primarySiteName)
  const parent = clean(f.domainName)
  if (!site || !parent || !/^[a-z0-9-]+$/.test(site)) return {}
  const inst = clean(f.deploymentInstance) || 'm01'
  // A Child Domain still holding our own earlier proposal follows the Site Code.
  const userChild = f.subDomainName && f.subDomainName !== auto.subDomainName ? clean(f.subDomainName) : ''
  const child = userChild || `${site}.${parent}`
  const ins = (h) => `${h}.${child}`          // instance (child zone)
  const flt = (h) => `${h}.${parent}`         // fleet (parent zone)
  const p = `${site}-${inst}`
  const out = {
    subDomainName: `${site}.${parent}`,
    vcfSddcFqdn: ins(`${site}-vcf01`),
    sddcHostname: `${site}-vcf01`,
    vcMgmtFqdn: ins(`${p}-vc01`),
    nsxMgr1Fqdn: ins(`${p}-nsx01a`), nsxMgr2Fqdn: ins(`${p}-nsx01b`), nsxMgr3Fqdn: ins(`${p}-nsx01c`),
    nsxVipFqdn: ins(`${p}-nsx01`),
    nsxEdge1Fqdn: ins(`${p}-en01`), nsxEdge2Fqdn: ins(`${p}-en02`),
    vcfOpsPrimaryFqdn: flt('flt-ops01a'), vcfOpsReplicaFqdn: flt('flt-ops01b'), vcfOpsDataFqdn: flt('flt-ops01c'),
    vcfOpsLbFqdn: flt('flt-ops01'),
    vcfOpsCollectorFqdn: ins(`${site}-cp01`),
    fleetComponentsFqdn: flt('flt-fc01'),
    instanceComponentsFqdn: ins(`${site}-ic01`),
    vcfSvcRuntimeFqdn: ins(`${site}-sr01`),
    licenseServerFqdn: flt('flt-lc01'),
    idBrokerFqdn: flt('flt-idb01'),
    vcfAutoFqdn: flt('flt-auto01'),
    vcfAutoSvcRuntimeFqdn: flt('flt-vcfa-sr01'),
    vcfLogsFqdn: flt('flt-logs01'),
    vcfNetOpsFqdn: flt('flt-net01a'),
    aviCtrl1Fqdn: ins(`${p}-avi01a`), aviCtrl2Fqdn: ins(`${p}-avi01b`), aviCtrl3Fqdn: ins(`${p}-avi01c`),
    aviClusterFqdn: ins(`${p}-avilb01`),
    vsanWitnessHost: ins(`${p}-cl01-vsw01`),
    drSrmFqdn: ins(`${p}-srm01`), drVrFqdn: ins(`${p}-vrms01`),
    ccmHcxFqdn: ins(`${site}-ccm-hcx01`),
  }
  const wld = clean(f.wldName) || `${site}-w01`
  out.wldVcFqdn = ins(`${wld}-vc01`)
  out.wldNsxVipFqdn = ins(`${wld}-nsx01`)

  // ESXi hosts — management cluster (AZ1, + AZ2 appended under vMSC), AZ2 list for vSAN stretched
  const az1 = cnt(f.mgmtHostCount, 4)
  const az2 = cnt(f.mgmtAz2HostCount, az1)
  for (let i = 1; i <= az1; i++) out[`m01Host${i}Fqdn`] = ins(`${site}01-${inst}-r01-esx${pad2(i)}`)
  if (isVmsc(f)) {
    for (let j = 1; j <= az2 && az1 + j <= 16; j++) out[`m01Host${az1 + j}Fqdn`] = ins(`${site}02-${inst}-r01-esx${pad2(j)}`)
  }
  if (isVsanStretched(f)) {
    for (let j = 1; j <= az2; j++) out[`az2Host${j}Fqdn`] = ins(`${site}02-${inst}-r01-esx${pad2(j)}`)
  }
  return out
}

// key -> [{ page, section, field }] (some keys, e.g. vcfOps*, appear on two pages)
let _index = null
function fieldIndex() {
  if (_index) return _index
  _index = {}
  for (const page of ALL_PAGES) for (const section of (page.sections || [])) for (const field of (section.fields || [])) {
    (_index[field.key] = _index[field.key] || []).push({ page, section, field })
  }
  return _index
}
function isVisible(key, f) {
  const occ = fieldIndex()[key]
  if (!occ) return true
  return occ.some(({ page, section, field }) =>
    (!page.showWhen || page.showWhen(f)) && (!section.showWhen || section.showWhen(f)) && (!field.showWhen || field.showWhen(f)))
}

// All keys the generator can ever touch (for clean-up of stale proposals).
const HOST_KEYS = []
for (let i = 1; i <= 16; i++) HOST_KEYS.push(`m01Host${i}Fqdn`, `az2Host${i}Fqdn`)

// Fills empty FQDN fields (and fields still holding a previous proposal) with the
// current proposal; user-typed values are never touched. Proposals are tracked in
// form._fqdnAuto so they follow later Site Code / Domain / host-count changes, and
// a stale proposal (field no longer visible / host row beyond the count) is cleared.
// Returns the number of fields changed.
export function applyFqdnProposals(f, { force = false } = {}) {
  if (!force && f.fqdnAutoPropose === 'Unselected') return 0
  const auto = (f._fqdnAuto && typeof f._fqdnAuto === 'object') ? f._fqdnAuto : {}
  const prop = proposeFqdns(f, auto)
  let changed = 0
  const keys = new Set([...Object.keys(prop), ...Object.keys(auto), ...HOST_KEYS])
  for (const key of keys) {
    const cur = f[key]
    const ownedByAuto = !cur || (auto[key] !== undefined && cur === auto[key])
    const want = prop[key] && isVisible(key, f) ? prop[key] : ''
    if (!ownedByAuto) { delete auto[key]; continue }
    if (want) {
      if (cur !== want) { f[key] = want; changed++ }
      auto[key] = want
    } else if (cur && auto[key] !== undefined) {
      f[key] = ''; delete auto[key]; changed++
    } else {
      delete auto[key]
    }
  }
  f._fqdnAuto = auto
  return changed
}
