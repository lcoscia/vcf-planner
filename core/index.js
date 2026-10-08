// VCF Planner shared core — single source of truth for the website (index.html)
// and the MCP server (mcp/). Pure ES modules, no build step, no DOM/Alpine coupling.
export { LT, LT_TABLES, VCFMS_911, SUBNET_MASKS } from './data.js'
export { PORTS_DATA } from './ports.js'
export { PREREQ_DATA, ALL_PAGES, SCALE_VSAN_STRETCHED, SCALE_VMSC, isVsanStretched, isVmsc, mgmtHostRows, az2HostRows } from './reference.js'
export { proposeFqdns, applyFqdnProposals } from './fqdn.js'
export { isNetworkPlannerExport, applyNetworkPlannerJson } from './np-import.js'
export * from './sizing.js'
export * from './validation.js'
export { IMPORT_MAPS, applyExcelWorkbook, getMappedSheetNames } from './excel-import.js'
