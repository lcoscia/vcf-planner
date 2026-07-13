// VCF Planner shared core — single source of truth for the website (index.html)
// and the MCP server (mcp/). Pure ES modules, no build step, no DOM/Alpine coupling.
export { LT, SUBNET_MASKS } from './data.js'
export { PORTS_DATA } from './ports.js'
export { PREREQ_DATA, ALL_PAGES } from './reference.js'
export * from './sizing.js'
export * from './validation.js'
export { EXCEL_IMPORT_MAP, applyExcelWorkbook, getMappedSheetNames } from './excel-import.js'
