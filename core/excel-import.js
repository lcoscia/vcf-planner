// Excel workbook import — maps cells from the official Broadcom "VCF 9.1 Planning &
// Preparation Workbook" onto our `form` state keys (as declared in ALL_PAGES,
// core/reference.js). Pure ES module, no DOM/Alpine/XLSX coupling — the caller is
// expected to parse the .xlsx file (e.g. with the SheetJS `xlsx` package) and pass in
// a plain `workbook` object shaped like `{ SheetNames: string[], Sheets: { [name]:
// WorkSheet } }`, where a WorkSheet is indexable by cell address
// (`worksheet['D12'] === { v: <value>, t: <type>, f?: <formula string> }`).
//
// ────────────────────────────────────────────────────────────────────────────
// ⚠️  CELL COORDINATES ARE UNCALIBRATED PLACEHOLDERS  ⚠️
// We do not have access to a real copy of the Broadcom workbook in this repo (it is
// gitignored and never committed). Every `cell:` address below was guessed from the
// field's position in the form wizard and MUST be validated/corrected against a real
// "VCF 9.1 Planning & Preparation Workbook" export before this mapping can be trusted.
// A more robust long-term approach: if the workbook exposes Excel Named Ranges (as
// VMware's own `VCF.JSONGenerator` PowerShell module reads them, rather than fixed
// A1-style coordinates), migrate EXCEL_IMPORT_MAP to reference names instead —
// named ranges survive row/column insertions across workbook revisions, fixed cell
// addresses do not.
// ────────────────────────────────────────────────────────────────────────────

// EXCEL_IMPORT_MAP: sheet name (best-effort, matches the workbook tab names) ->
// list of { key, cell, type } entries. `key` must be an existing form.* key from
// ALL_PAGES (core/reference.js) — never invent a new one here.
export const EXCEL_IMPORT_MAP = {
  'Deploy Management Domain': [
    // General Information
    { key: 'domainName',    cell: 'D10', type: 'text' },
    { key: 'subDomainName', cell: 'D11', type: 'text' },
    { key: 'vcfSddcFqdn',   cell: 'D12', type: 'text' },
    { key: 'vcfSddcIp',     cell: 'D13', type: 'ip' },
    { key: 'ntpServer1',    cell: 'D14', type: 'text' },
    { key: 'ntpServer2',    cell: 'D15', type: 'text' },
    { key: 'dnsServer1',    cell: 'D16', type: 'ip' },
    { key: 'dnsServer2',    cell: 'D17', type: 'ip' },

    // Networks — Management (ESX Management / VM Management)
    { key: 'esxMgmtVlan',    cell: 'D22', type: 'number' },
    { key: 'esxMgmtGateway', cell: 'D23', type: 'ip' },
    { key: 'esxMgmtCidr',    cell: 'D24', type: 'cidr' },
    { key: 'esxMgmtMtu',     cell: 'D25', type: 'number' },
    { key: 'vmMgmtVlan',     cell: 'D26', type: 'number' },
    { key: 'vmMgmtGateway',  cell: 'D27', type: 'ip' },
    { key: 'vmMgmtCidr',     cell: 'D28', type: 'cidr' },
    { key: 'vmMgmtMtu',      cell: 'D29', type: 'number' },

    // Networks — vMotion, vSAN & Overlay
    { key: 'vmotionVlan',    cell: 'D33', type: 'number' },
    { key: 'vmotionGateway', cell: 'D34', type: 'ip' },
    { key: 'vmotionCidr',    cell: 'D35', type: 'cidr' },
    { key: 'vmotionMtu',     cell: 'D36', type: 'number' },
    { key: 'vsan1Vlan',      cell: 'D37', type: 'number' },
    { key: 'vsan1Gateway',   cell: 'D38', type: 'ip' },
    { key: 'vsan1Cidr',      cell: 'D39', type: 'cidr' },
    { key: 'vsan1Mtu',       cell: 'D40', type: 'number' },
    { key: 'overlayVlan',    cell: 'D41', type: 'number' },
    { key: 'overlayGateway', cell: 'D42', type: 'ip' },
    { key: 'overlayCidr',    cell: 'D43', type: 'cidr' },
    { key: 'overlayMtu',     cell: 'D44', type: 'number' },

    // vCenter Server
    { key: 'vcMgmtFqdn',   cell: 'D48', type: 'text' },
    { key: 'vcMgmtIp',     cell: 'D49', type: 'ip' },
    { key: 'vcMgmtSize',   cell: 'D50', type: 'select' },
    { key: 'vcSsoDomain',  cell: 'D51', type: 'text' },
    { key: 'vcDatacenter', cell: 'D52', type: 'text' },
    { key: 'vcCluster',    cell: 'D53', type: 'text' },
    { key: 'vcDatastore',  cell: 'D54', type: 'text' },

    // SDDC Manager
    { key: 'sddcHostname', cell: 'D58', type: 'text' },
    { key: 'sddcLocation', cell: 'D59', type: 'select' },

    // NSX Manager Cluster
    { key: 'nsxMgr1Fqdn', cell: 'D63', type: 'text' },
    { key: 'nsxMgr1Ip',   cell: 'D64', type: 'ip' },
    { key: 'nsxMgr2Fqdn', cell: 'D65', type: 'text' },
    { key: 'nsxMgr2Ip',   cell: 'D66', type: 'ip' },
    { key: 'nsxMgr3Fqdn', cell: 'D67', type: 'text' },
    { key: 'nsxMgr3Ip',   cell: 'D68', type: 'ip' },
    { key: 'nsxVipFqdn',  cell: 'D69', type: 'text' },
    { key: 'nsxVipIp',    cell: 'D70', type: 'ip' },
    { key: 'nsxMgrSize',  cell: 'D71', type: 'select' },

    // Distributed Switch Profile
    { key: 'dvsName', cell: 'D75', type: 'text' },
    { key: 'dvsMtu',  cell: 'D76', type: 'number' },

    // TODO: dynamic per-host arrays (makeHostFields: m01Host1Fqdn..m01Host16Ip) are
    // not mapped in this first pass — the workbook lays these out as a repeating
    // table rather than fixed labelled cells, so they need a row-scanning strategy
    // (iterate down a column until an empty row is hit) instead of a static
    // { key, cell } entry per host. Same applies to NSX Edge nodes / uplink NIC
    // lists (makeUplinkFields) and per-portgroup blocks (makePortGroupFields) —
    // left out here on purpose, revisit once the row-scan helper exists.
  ],

  'Configure Management Domain': [
    // vSphere Cluster Settings
    { key: 'evcMode', cell: 'D10', type: 'select' },

    // SFTP Backup Configuration
    { key: 'sftpBackupInclude', cell: 'D14', type: 'select' },
    { key: 'sftpHost',          cell: 'D15', type: 'text' },
    { key: 'sftpPort',           cell: 'D16', type: 'number' },
    { key: 'sftpUser',           cell: 'D17', type: 'text' },
    { key: 'sftpPath',           cell: 'D18', type: 'text' },

    // Certificate Authority
    { key: 'caType',       cell: 'D23', type: 'select' },
    { key: 'caFqdn',       cell: 'D24', type: 'text' },
    { key: 'caAdminUser',  cell: 'D25', type: 'text' },
    { key: 'caTemplate',   cell: 'D26', type: 'text' },
    { key: 'certKeySize',  cell: 'D27', type: 'select' },
    { key: 'caOrg',        cell: 'D28', type: 'text' },
    { key: 'caOrgUnit',    cell: 'D29', type: 'text' },
    { key: 'caCountry',    cell: 'D30', type: 'text' },
    { key: 'caState',      cell: 'D31', type: 'text' },
    { key: 'caLocality',   cell: 'D32', type: 'text' },

    // NSX Network Connectivity
    { key: 'nsxConnectivity',    cell: 'D37', type: 'select' },
    { key: 'nsxRoutingProtocol', cell: 'D38', type: 'select' },
    { key: 'nsxT0Name',          cell: 'D39', type: 'text' },
    { key: 'nsxT0Asn',           cell: 'D40', type: 'number' },
    { key: 'nsxUpstreamAsn',     cell: 'D41', type: 'number' },
    { key: 'nsxUpstreamIp1',     cell: 'D42', type: 'ip' },
    { key: 'nsxUpstreamIp2',     cell: 'D43', type: 'ip' },
    { key: 'nsxExtIpBlock',      cell: 'D44', type: 'cidr' },

    // vSphere Supervisor (Kubernetes)
    { key: 'supervisorInclude',      cell: 'D49', type: 'select' },
    { key: 'supervisorCluster',      cell: 'D50', type: 'text' },
    { key: 'supervisorStoragePolicy',cell: 'D51', type: 'text' },
    { key: 'supervisorContentLib',   cell: 'D52', type: 'text' },
    { key: 'supervisorCidr',         cell: 'D53', type: 'cidr' },
    { key: 'supervisorEgressCidr',   cell: 'D54', type: 'cidr' },
    { key: 'supervisorName',         cell: 'D55', type: 'text' },
    { key: 'supervisorServiceCidr',  cell: 'D56', type: 'cidr' },

    // TODO: NSX Federation (Multi-Site) block left out of this first pass — its
    // fields only apply showWhen nsxFedRole !== 'Exclude' and the workbook layout
    // for the federation sheet/section hasn't been inspected yet.
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

// applyExcelWorkbook(workbook, form)
// workbook: SheetJS-shaped { SheetNames: string[], Sheets: { [name]: WorkSheet } }.
// form: plain reactive object, MUTATED in place — a matched, non-empty cell wins,
// but only ever a real value overwrites an existing form field (never blanks it out).
export function applyExcelWorkbook(workbook, form) {
  const report = {
    // Not yet identified: we don't have a real workbook copy to confirm which cell
    // (if any) carries a workbook/template version string. Leaving this null rather
    // than guessing a coordinate and presenting a false certainty; wire this up once
    // a real "VCF 9.1 Planning & Preparation Workbook" sample is available to
    // inspect (e.g. a cover-sheet "Version" or "Revision" cell).
    detectedVersion: null,
    applied: [],
    skipped: [],
    ambiguous: [],
  }

  const sheetNames = (workbook && workbook.SheetNames) || []
  const sheets = (workbook && workbook.Sheets) || {}

  for (const [sheetName, entries] of Object.entries(EXCEL_IMPORT_MAP)) {
    const sheetPresent = sheetNames.includes(sheetName)

    for (const entry of entries) {
      const { key, cell, type } = entry

      if (!sheetPresent) {
        report.skipped.push({ key, sheet: sheetName, cell, reason: 'sheet not found in workbook' })
        continue
      }

      const worksheet = sheets[sheetName]
      const cellObj = worksheet ? worksheet[cell] : undefined

      // Known pitfall: a cell can carry a cached formula result (`.v`) alongside its
      // formula source (`.f`, e.g. "=CONCATENATE(...)"). We deliberately only ever
      // read `.v` — the value Excel computed and cached at save time — because `.f`
      // is an uninterpreted formula string, not a value, and this module has no
      // spreadsheet formula engine to evaluate it.
      const rawValue = cellObj ? cellObj.v : undefined

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
