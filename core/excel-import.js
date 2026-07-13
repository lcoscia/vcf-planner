// Excel workbook import — maps cells from the official Broadcom "VCF 9.1 Planning &
// Preparation Workbook" onto our `form` state keys (as declared in ALL_PAGES,
// core/reference.js). Pure ES module, no DOM/Alpine/XLSX coupling — the caller is
// expected to parse the .xlsx file (e.g. with the SheetJS `xlsx` package) and pass in
// a plain `workbook` object shaped like `{ SheetNames: string[], Sheets: { [name]:
// WorkSheet } }`, where a WorkSheet is indexable by cell address
// (`worksheet['D12'] === { v: <value>, t: <type>, f?: <formula string> }`).
//
// ────────────────────────────────────────────────────────────────────────────
// CALIBRATION STATUS (2026-07-13): every `cell:` address below has been verified
// directly against a real "vcf-9.1-planning-and-preparation-workbook-25june2026.xlsx"
// export (label in the adjacent column + sample value both checked, see the audit
// notes in git history) — this replaces an earlier, uncalibrated draft that guessed
// coordinates from the web form's field order and was confirmed to write garbage
// values into the form (e.g. a "Final Result" summary-table cell landing on
// `supervisorCidr`). Anything not listed here is deliberately NOT mapped rather than
// guessed — see the "NOT MAPPED" notes below each sheet.
//
// Long-term robustness note: the workbook exposes hundreds of Excel Named Ranges
// (e.g. `input_mgmt_vc_fqdn`) that VMware's own `VCF.JSONGenerator` PowerShell module
// reads instead of fixed A1 coordinates — named ranges survive row/column insertions
// across workbook revisions, fixed cell addresses do not. Migrating EXCEL_IMPORT_MAP
// to reference names is the recommended next step (tracked separately); until then,
// re-run the calibration below against any new workbook revision before trusting it.
// ────────────────────────────────────────────────────────────────────────────

// EXCEL_IMPORT_MAP: sheet name (matches the workbook tab name) -> list of entries.
// Two entry shapes:
//   { key, cell, type }                      — one workbook cell -> one form.* key.
//   { gatewayKey, cidrKey, cell, type:'gatewayCidr' } — the workbook stores a single
//     "gateway IP (CIDR notation)" cell (e.g. "10.11.11.1/24"); the form instead has
//     two separate keys (`${prefix}Gateway` = the gateway IP itself, `${prefix}Cidr`
//     = the network address in CIDR notation, e.g. "10.11.11.0/24") — see
//     splitGatewayCidr() below for how the network address is derived.
export const EXCEL_IMPORT_MAP = {
  'Deploy Management Domain': [
    // DNS / NTP
    { key: 'dnsServer1', cell: 'L72', type: 'ip' },
    { key: 'dnsServer2', cell: 'L73', type: 'ip' },
    { key: 'ntpServer1', cell: 'L75', type: 'text' },
    { key: 'ntpServer2', cell: 'L76', type: 'text' },

    // Networks — Management / vMotion / vSAN / Overlay (VLAN IDs; gateway+CIDR are
    // a single combined workbook cell, see the gatewayCidr entries below)
    { key: 'esxMgmtVlan', cell: 'L102', type: 'number' },
    { gatewayKey: 'esxMgmtGateway', cidrKey: 'esxMgmtCidr', cell: 'L104', type: 'gatewayCidr' },
    { key: 'vmMgmtVlan', cell: 'L107', type: 'number' },
    { gatewayKey: 'vmMgmtGateway', cidrKey: 'vmMgmtCidr', cell: 'L109', type: 'gatewayCidr' },
    { key: 'vmotionVlan', cell: 'L125', type: 'number' },
    { key: 'vsan1Vlan', cell: 'L133', type: 'number' },
    { key: 'overlayVlan', cell: 'L147', type: 'number' },

    // vCenter Server
    { key: 'vcMgmtFqdn', cell: 'L181', type: 'text' },
    { key: 'vcDatacenter', cell: 'L182', type: 'text' },
    { key: 'vcCluster', cell: 'L183', type: 'text' },
    { key: 'vcSsoDomain', cell: 'L184', type: 'text' },
    { key: 'vcDatastore', cell: 'L190', type: 'text' },
    { key: 'vcMgmtSize', cell: 'L327', type: 'select' },

    // Distributed Switch Profile
    { key: 'dvsName', cell: 'L206', type: 'text' },
    { key: 'dvsMtu', cell: 'L207', type: 'number' },

    // NSX Manager Cluster
    { key: 'nsxVipFqdn', cell: 'L278', type: 'text' },
    { key: 'nsxMgr1Fqdn', cell: 'L279', type: 'text' },
    { key: 'nsxMgr2Fqdn', cell: 'L280', type: 'text' },
    { key: 'nsxMgr3Fqdn', cell: 'L281', type: 'text' },
    { key: 'nsxMgrSize', cell: 'L330', type: 'select' },

    // SDDC Manager
    { key: 'sddcLocation', cell: 'L291', type: 'select' },
    { key: 'vcfSddcFqdn', cell: 'L292', type: 'text' },

    // Reference IP Address block (a separate section ~100 rows below the FQDN
    // fields above — confirmed by row order matching the sample IPs, not adjacency)
    { key: 'vcfSddcIp', cell: 'L387', type: 'ip' },
    { key: 'vcMgmtIp', cell: 'L388', type: 'ip' },
    { key: 'nsxVipIp', cell: 'L390', type: 'ip' },
    { key: 'nsxMgr1Ip', cell: 'L391', type: 'ip' },
    { key: 'nsxMgr2Ip', cell: 'L392', type: 'ip' },
    { key: 'nsxMgr3Ip', cell: 'L393', type: 'ip' },

    // NOT MAPPED (no direct workbook equivalent found as of v1.9.1.005 — do not
    // guess a coordinate for these, leave them for manual entry after import):
    //   domainName, subDomainName — no distinct "DNS Domain Name" input cell found;
    //     the closest candidate (row 68, "Management domain name") is a short SDDC
    //     code like "sfo-m01", not the domain name the form expects.
    //   sddcHostname — only the SDDC Manager FQDN (L292) exists; no separate
    //     short-hostname input cell.
    //   evcMode — no EVC field found on this sheet for the management domain (an
    //     EVC selector exists only for workload domains, sheet 'Dumping Ground').
    //
    // TODO: dynamic per-host arrays (makeHostFields: m01Host1Fqdn..m01Host16Ip) are
    // not mapped in this first pass — the workbook lays these out as a repeating
    // table rather than fixed labelled cells, so they need a row-scanning strategy
    // (iterate down a column until an empty row is hit) instead of a static
    // { key, cell } entry per host. Same applies to NSX Edge nodes / uplink NIC
    // lists (makeUplinkFields) and per-portgroup blocks (makePortGroupFields) —
    // left out here on purpose, revisit once the row-scan helper exists.
  ],

  'Configure Management Domain': [
    // SFTP Backup Configuration
    { key: 'sftpHost', cell: 'D22', type: 'text' },
    { key: 'sftpPort', cell: 'D23', type: 'number' },
    { key: 'sftpPath', cell: 'D27', type: 'text' },

    // Certificate Authority
    { key: 'caFqdn', cell: 'D34', type: 'text' },
    { key: 'caAdminUser', cell: 'D35', type: 'text' },
    { key: 'caTemplate', cell: 'D46', type: 'text' },
    { key: 'caOrg', cell: 'D60', type: 'text' },      // workbook label: "Organization"
    { key: 'caOrgUnit', cell: 'D61', type: 'text' },  // workbook label: "Organizational Unit"
    { key: 'caCountry', cell: 'D62', type: 'text' },
    { key: 'caState', cell: 'D63', type: 'text' },
    { key: 'caLocality', cell: 'D64', type: 'text' },
    { key: 'certKeySize', cell: 'D66', type: 'select' },

    // NOT MAPPED — the previous draft guessed coordinates for sftpBackupInclude,
    // caType, the NSX Network Connectivity block (nsxConnectivity,
    // nsxRoutingProtocol, nsxT0Name, nsxT0Asn, nsxUpstreamAsn, nsxUpstreamIp1/2,
    // nsxExtIpBlock) and the vSphere Supervisor block (supervisorInclude,
    // supervisorCluster, supervisorStoragePolicy, supervisorContentLib,
    // supervisorCidr, supervisorEgressCidr, supervisorName, supervisorServiceCidr).
    // Those guesses were confirmed WRONG: rows 12-17 of this sheet are a
    // "Select Option / Feature / Final Result" summary table (computed toggle
    // results, not free-form inputs), and writing its "Final Result" column into
    // e.g. supervisorCidr produced garbage ("Microsoft", a certsrv URL fragment).
    // Deliberately left unmapped until the real input cells for these sections are
    // located and verified the same way as the fields above — do not re-add
    // guessed coordinates here.
  ],
}

// getMappedSheetNames() — small helper for UI/debug surfaces (e.g. "this importer
// currently understands N of the workbook's 27 sheets").
export function getMappedSheetNames() {
  return Object.keys(EXCEL_IMPORT_MAP)
}

// Normalizes a raw cell value into the string the form expects. Trims and collapses
// internal whitespace runs — Excel cells routinely carry trailing spaces / line
// wraps that would otherwise silently break FQDN/IP validation downstream.
function normalizeValue(raw) {
  return String(raw).trim().replace(/\s+/g, ' ')
}

function ipToInt(ip) {
  const parts = ip.split('.').map(n => parseInt(n, 10))
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(int) {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.')
}

// splitGatewayCidr("10.11.11.1/24") -> { gateway: "10.11.11.1", cidr: "10.11.11.0/24" }
// The workbook stores the gateway's own IP + prefix length in one cell; the form
// wants the gateway IP and the network address (host bits zeroed) as two fields.
// Returns null if the value doesn't match "<ip>/<prefix>".
function splitGatewayCidr(raw) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/.exec(raw)
  if (!m) return null
  const [, ip, prefixStr] = m
  const prefix = parseInt(prefixStr, 10)
  if (prefix < 0 || prefix > 32 || ip.split('.').some(o => Number(o) > 255)) return null
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0
  const network = intToIp(ipToInt(ip) & mask)
  return { gateway: ip, cidr: `${network}/${prefix}` }
}

// detectWorkbookVersion(workbook) — the "Version History" sheet lists revisions
// newest-first immediately below a "Version" / "Date" header row (verified against
// v1.9.1.004 and v1.9.1.005: a new row is inserted right after the header on every
// release, pushing older rows down). Scanning for the header instead of a fixed row
// number survives that insertion. Returns null if the sheet/header/pattern isn't
// found rather than guessing.
function detectWorkbookVersion(workbook) {
  const sheetNames = (workbook && workbook.SheetNames) || []
  if (!sheetNames.includes('Version History')) return null
  const ws = workbook.Sheets['Version History']
  if (!ws) return null

  const ref = ws['!ref']
  const maxRow = ref ? parseInt(ref.split(':')[1].replace(/[A-Z]/g, ''), 10) : 50
  for (let row = 1; row <= Math.min(maxRow, 50); row++) {
    const label = ws[`B${row}`]
    if (label && String(label.v).trim() === 'Version') {
      const versionCell = ws[`B${row + 1}`]
      const dateCell = ws[`C${row + 1}`]
      const version = versionCell ? String(versionCell.v).trim() : ''
      if (/^v\d+(\.\d+)*$/.test(version)) {
        return dateCell ? `${version} (${String(dateCell.v).trim()})` : version
      }
      return null
    }
  }
  return null
}

// applyExcelWorkbook(workbook, form)
// workbook: SheetJS-shaped { SheetNames: string[], Sheets: { [name]: WorkSheet } }.
// form: plain reactive object, MUTATED in place — a matched, non-empty cell wins,
// but only ever a real value overwrites an existing form field (never blanks it out).
export function applyExcelWorkbook(workbook, form) {
  const report = {
    detectedVersion: detectWorkbookVersion(workbook),
    applied: [],
    skipped: [],
    ambiguous: [],
  }

  const sheetNames = (workbook && workbook.SheetNames) || []
  const sheets = (workbook && workbook.Sheets) || {}

  for (const [sheetName, entries] of Object.entries(EXCEL_IMPORT_MAP)) {
    const sheetPresent = sheetNames.includes(sheetName)
    const worksheet = sheetPresent ? sheets[sheetName] : undefined

    for (const entry of entries) {
      const { cell } = entry

      if (!sheetPresent) {
        const keys = entry.type === 'gatewayCidr' ? [entry.gatewayKey, entry.cidrKey] : [entry.key]
        for (const key of keys) report.skipped.push({ key, sheet: sheetName, cell, reason: 'sheet not found in workbook' })
        continue
      }

      // Known pitfall: a cell can carry a cached formula result (`.v`) alongside its
      // formula source (`.f`, e.g. "=CONCATENATE(...)"). We deliberately only ever
      // read `.v` — the value Excel computed and cached at save time — because `.f`
      // is an uninterpreted formula string, not a value, and this module has no
      // spreadsheet formula engine to evaluate it.
      const cellObj = worksheet ? worksheet[cell] : undefined
      const rawValue = cellObj ? cellObj.v : undefined

      if (entry.type === 'gatewayCidr') {
        const { gatewayKey, cidrKey } = entry
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          report.skipped.push({ key: gatewayKey, sheet: sheetName, cell, reason: 'empty cell' })
          report.skipped.push({ key: cidrKey, sheet: sheetName, cell, reason: 'empty cell' })
          continue
        }
        const split = splitGatewayCidr(normalizeValue(rawValue))
        if (!split) {
          report.ambiguous.push({
            key: `${gatewayKey}/${cidrKey}`, sheet: sheetName, cell, rawValue,
            reason: 'expected "<ip>/<prefix>" (e.g. 10.11.11.1/24), could not parse',
          })
          continue
        }
        form[gatewayKey] = split.gateway
        form[cidrKey] = split.cidr
        report.applied.push({ key: gatewayKey, sheet: sheetName, cell, value: split.gateway })
        report.applied.push({ key: cidrKey, sheet: sheetName, cell, value: split.cidr })
        continue
      }

      const { key, type } = entry

      if (rawValue === undefined || rawValue === null || rawValue === '') {
        report.skipped.push({ key, sheet: sheetName, cell, reason: 'empty cell' })
        continue
      }

      const value = normalizeValue(rawValue)
      if (value === '') {
        report.skipped.push({ key, sheet: sheetName, cell, reason: 'empty cell' })
        continue
      }

      if (type === 'select' || type === 'toggle') {
        // First-pass behaviour: apply the raw (trimmed) value as-is. We don't have
        // access to the field's option list here (it lives in ALL_PAGES, coupled to
        // the full form state via optionsFn for some fields) — strict validation
        // against the known options is deferred to a later iteration once the UI
        // import-report surface exists to show these as warnings rather than
        // silently rejecting them. For now we still record it in `applied`, but flag
        // it in `ambiguous` too so the caller can cross-check.
        form[key] = value
        report.applied.push({ key, sheet: sheetName, cell, value })
        report.ambiguous.push({
          key, sheet: sheetName, cell, rawValue: value,
          reason: 'select/toggle value applied without validation against known options (deferred to a later iteration)',
        })
        continue
      }

      // 'text' | 'ip' | 'cidr' | 'number' — plain string cast, already trimmed above.
      form[key] = value
      report.applied.push({ key, sheet: sheetName, cell, value })
    }
  }

  return report
}
