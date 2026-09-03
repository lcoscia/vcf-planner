// Static reference tables for VCF 9.1 sizing — extracted verbatim from index.html.
// Verified against the official Excel "Static Reference Tables" sheet by tools/check_lt_constants.py.
//
// LT_TABLES is keyed by workbook version family ('9.1.0' | '9.1.1') — Broadcom
// changed several sizing constants in 9.1.1 (SSP tiers, SSP License, VCF Operations
// Proxy tiers, VCF Operations for Networks tiers/disk, vCenter Disk storage-size
// aliases), confirmed by diffing both real workbooks' "Static Reference Tables"
// sheet. '9.1.1' below is the '9.1.0' table with only the changed keys overridden —
// see core/sizing.js's ltFor() for how a calculation picks the right one from
// s.workbookVersion.
const LT_910 = {
  vcenter: {
    'Tiny':   { vcpu:2,  ram:14,  disk:619  },
    'Small':  { vcpu:4,  ram:21,  disk:734  },
    'Medium': { vcpu:8,  ram:30,  disk:933  },
    'Large':  { vcpu:16, ram:39,  disk:1383 },
    'XLarge': { vcpu:24, ram:58,  disk:2308 },
  },
  // vCenter disk size by Appliance Size + Storage Size tier (Default/Large/XLarge) — used by the
  // Advanced Management Domain Sizer's "vCenter Storage Size" selector
  vcenter_disk_tiers: {
    'Tiny':   { Default:619,  Large:2059, XLarge:4319 },
    'Small':  { Default:734,  Large:2084, XLarge:4344 },
    'Medium': { Default:933,  Large:2233, XLarge:4493 },
    'Large':  { Default:1383, Large:2283, XLarge:4543 },
    'XLarge': { Default:2308, Large:2408, XLarge:4668 },
  },
  // Workload Domain dedicated vCenter Server Appliance — same VCSA specs as the management vCenter
  wld_vcenter: {
    'Tiny':   { vcpu:2,  ram:14,  disk:619  },
    'Small':  { vcpu:4,  ram:21,  disk:734  },
    'Medium': { vcpu:8,  ram:30,  disk:933  },
    'Large':  { vcpu:16, ram:39,  disk:1383 },
    'XLarge': { vcpu:24, ram:58,  disk:2308 },
  },
  sddc_manager: { vcpu:4, ram:16, disk:914 },
  nsx_manager: {
    'Extra_Small': { vcpu:2,  ram:8,  disk:300 },
    'Small':  { vcpu:4,  ram:16, disk:300 },
    'Medium': { vcpu:6,  ram:24, disk:300 },
    'Large':  { vcpu:12, ram:48, disk:300 },
    'XLarge': { vcpu:24, ram:96, disk:400 },
  },
  nsx_edge: {
    'Excluded':        { vcpu:0,  ram:0,   disk:0   },
    'NSX Edge Small':  { vcpu:2,  ram:4,   disk:200 },
    'NSX Edge Medium': { vcpu:4,  ram:8,   disk:200 },
    'NSX Edge Large':  { vcpu:8,  ram:32,  disk:200 },
    'NSX Edge XLarge': { vcpu:16, ram:64,  disk:200 },
    'VNA Small':       { vcpu:2,  ram:4,   disk:200 },
    'VNA Medium':      { vcpu:4,  ram:8,   disk:200 },
    'VNA Large':       { vcpu:8,  ram:32,  disk:200 },
    'VNA XLarge':      { vcpu:16, ram:64,  disk:200 },
  },
  vcf_operations: {
    'Extra-Small': { vcpu:2,  ram:8,  disk:274 },
    'Small':       { vcpu:4,  ram:16, disk:274 },
    'Medium':      { vcpu:8,  ram:32, disk:274 },
    'Large':       { vcpu:16, ram:48, disk:274 },
    'Extra-Large': { vcpu:24, ram:128,disk:274 },
  },
  // Log Management (vRLI) per-replica disk — same value for Small/Medium/Large in the Excel
  // 'vRLI Disk' table; CPU/RAM per node come from the VCFMS worker tier (see logMgmtAggregate()).
  vrli_disk: 575,
  avi_lb: {
    'Small':      { vcpu:6,  ram:32, disk:512  },
    'Large':      { vcpu:16, ram:48, disk:1400 },
    'Extra-Large':{ vcpu:16, ram:64, disk:1750 },
  },
  vcfa: {
    'Small':  { vcpu:24, ram:96,  disk:600 },
    'Medium': { vcpu:24, ram:96,  disk:900 },
    'Large':  { vcpu:32, ram:128, disk:1200 },
  },
  ssp: {
    'Excluded': { vcpu:0,  ram:0,   disk:0    },
    'Include':  { vcpu:96, ram:350, disk:3867, nodes:8 },
  },
  // "vDefend and AVI Licensing Hub" — added once whenever any SSP (mgmt or WLD) is not Excluded
  ssp_license: { vcpu:10, ram:30, disk:725 },

  // ── VCF Management Services / VCF Fleet Components (fixed-size — no Small/Medium/Large tiers in the Excel) ──
  // Stored as flat {vcpu,ram,disk} objects (same shape as sddc_manager) so calc functions
  // can read LT.key.vcpu directly without special-casing a tier lookup.
  // VCFMS Control/Worker node specs and node counts — aggregated by instanceProfileSize + clusterModel
  vcfms_control_node: {
    'Small':    { vcpu:4, ram:10, disk:100 },
    'Small HA': { vcpu:4, ram:10, disk:100 },
    'Medium':   { vcpu:4, ram:10, disk:100 },
    'Large':    { vcpu:8, ram:14, disk:100 },
  },
  vcfms_worker_node: {
    'Small':  { vcpu:12, ram:24, disk:100 },
    'Medium': { vcpu:24, ram:48, disk:100 },
    'Large':  { vcpu:24, ram:48, disk:100 },
  },
  vcfms_control_nodes: { 'Simple':1, 'High Availability':3 },
  vcfms_worker_nodes:  { 'Small':3, 'Medium':3, 'Large':4 },
  // Additional VCF Services Runtime worker disk on top of (worker node count × per-node disk),
  // based on "Instance Model" (First/Additional Instance) × Deployment Size
  vcfms_extra_disk: {
    'First Instance':      { 'Small':2600, 'Medium':3000, 'Large':3702 },
    'Additional Instance': { 'Small':800,  'Medium':1002, 'Large':1200 },
  },
  cloud_proxy:                { vcpu:4,  ram:16, disk:264  }, // 1 node, default/fallback (= 'Small' tier)
  // VCF Operations Proxy (Cloud Proxy) sizing tiers — Advanced Sizer "Cloud Proxy" selector
  vcfops_proxy: {
    'Small':  { vcpu:4, ram:16, disk:264 },
    'Medium': { vcpu:8, ram:48, disk:264 },
    'Large':  { vcpu:8, ram:48, disk:264 },
  },
  license_server:             { vcpu:2,  ram:4,  disk:12   }, // 1 node
  // VCF Operations for Networks — Small/Medium/Large
  vcf_ops_networks: {
    'Small':  { vcpu:4,  ram:16, disk:1024 },
    'Medium': { vcpu:8,  ram:32, disk:1024 },
    'Large':  { vcpu:12, ram:48, disk:1024 },
  },
  // VCF Operations for Networks — Collector
  vcf_ops_networks_collector: {
    'Small':             { vcpu:2,  ram:4,  disk:250 },
    'Medium':            { vcpu:4,  ram:12, disk:250 },
    'Large':             { vcpu:8,  ram:16, disk:250 },
    'Extra-Large':       { vcpu:8,  ram:24, disk:250 },
    'Extra-Extra-Large': { vcpu:16, ram:48, disk:300 },
  },
  // Real-time Metrics disk is flat 205 GB; CPU/RAM = node count (2, or 3 for Large
  // Instance Profile) × VCFMS worker tier — see rtMetricsAggregate()
  realtime_metrics_disk:      205,
  // Identity Broker (Additional Instance) — Small/Medium/Large/XLarge
  identity_broker: {
    'Small':  { vcpu:2, ram:4, disk:10 },
    'Medium': { vcpu:2, ram:4, disk:10 },
    'Large':  { vcpu:4, ram:8, disk:20 },
    'XLarge': { vcpu:4, ram:8, disk:20 },
  },
  // Software Depot (additional instance only): Excel counts 1500 GB disk, CPU/RAM are "N/A" (not summed)
  software_depot:             { vcpu:0,  ram:0,  disk:1500 },
  // VRMS (vSphere Replication Management Server)
  vrms: {
    'Light':    { vcpu:2, ram:8, disk:33 },
    'Standard': { vcpu:4, ram:8, disk:33 },
  },
  // SRM (Site Recovery Manager)
  srm: {
    'Light':    { vcpu:2, ram:8,  disk:20  },
    'Standard': { vcpu:8, ram:24, disk:800 },
  },
  // Health Reporting and Monitoring (HVM)
  hvm: { vcpu:2, ram:8, disk:20 },
  // Cloud-Based Ransomware Recovery
  cloud_ransomware: { vcpu:8, ram:12, disk:100 },
  // HCX Connector (Cross-Cloud Mobility)
  hcx_connector: { vcpu:4, ram:12, disk:65 },
}

// 9.1.1 overrides — everything not listed here is unchanged from LT_910 (spread below).
// Verified against a real vcf-9.1.1-planning-and-preparation-workbook.xlsx export
// (2026-09-03). vcfms_worker_node/vcfms_extra_disk are intentionally NOT overridden
// here even though 9.1.1 restructured that table too — 9.1.1's VCF services runtime
// worker-node sizing is a different formula entirely (capacity-driven, not a flat
// tier lookup), implemented separately in core/sizing.js using VCFMS_911 below.
const LT_911 = {
  ...LT_910,
  // SSP: single 'Include' tier (96 vCPU/350 GB/3867 GB) -> three size tiers.
  ssp: {
    'Excluded': { vcpu:0,   ram:0,   disk:0    },
    'Medium':   { vcpu:64,  ram:222, disk:3260 },
    'Large':    { vcpu:96,  ram:350, disk:3600 },
    'XLarge':   { vcpu:160, ram:606, disk:6120 },
  },
  // vDefend/AVI Licensing Hub cost dropped alongside the SSP retier (10/30/725 -> 6/12/256)
  ssp_license: { vcpu:6, ram:12, disk:256 },
  // Cloud Proxy: Medium/Large merged into a single 'Standard' tier (same values as old Medium/Large)
  vcfops_proxy: {
    'Small':    { vcpu:4, ram:16, disk:264 },
    'Standard': { vcpu:8, ram:48, disk:264 },
  },
  // VCF Operations for Networks: gains XL/XXL; Large disk 1024 -> 2048
  vcf_ops_networks: {
    'Small':  { vcpu:4,  ram:16,  disk:1024 },
    'Medium': { vcpu:8,  ram:32,  disk:1024 },
    'Large':  { vcpu:12, ram:48,  disk:2048 },
    'XL':     { vcpu:16, ram:64,  disk:2048 },
    'XXL':    { vcpu:24, ram:128, disk:2048 },
  },
  // Collector: same tiers/values as 9.1.0, just renamed (Extra Large -> XL, Extra Extra Large -> XXL)
  vcf_ops_networks_collector: {
    'Small':  { vcpu:2,  ram:4,  disk:250 },
    'Medium': { vcpu:4,  ram:12, disk:250 },
    'Large':  { vcpu:8,  ram:16, disk:250 },
    'XL':     { vcpu:8,  ram:24, disk:250 },
    'XXL':    { vcpu:16, ram:48, disk:300 },
  },
  // vCenter Disk: gains lstorage/xlstorage aliases (same values as Large/XLarge) —
  // the 9.1.1 workbook renamed the "Appliance Storage Size" options to
  // Default/lstorage/xlstorage.
  vcenter_disk_tiers: {
    'Tiny':   { Default:619,  Large:2059, XLarge:4319, lstorage:2059, xlstorage:4319 },
    'Small':  { Default:734,  Large:2084, XLarge:4344, lstorage:2084, xlstorage:4344 },
    'Medium': { Default:933,  Large:2233, XLarge:4493, lstorage:2233, xlstorage:4493 },
    'Large':  { Default:1383, Large:2283, XLarge:4543, lstorage:2283, xlstorage:4553 },
    'XLarge': { Default:2308, Large:2408, XLarge:4668, lstorage:2408, xlstorage:4668 },
  },
}

export const LT_TABLES = { '9.1.0': LT_910, '9.1.1': LT_911 }
// Back-compat alias — only core/sizing.js and tools/check_lt_constants.py import
// `LT` directly, and both are version-aware now; kept so nothing else that might
// import it breaks silently.
export const LT = LT_910

// 9.1.1-only: the VCF services runtime (VCFMS) worker-node sizing model was
// replaced wholesale in 9.1.1 — no longer a flat per-size node-count/CPU/RAM/disk
// lookup (that's LT_910.vcfms_worker_node / vcfms_extra_disk), but a capacity-driven
// formula: node count = MAX(ramNodes, cpuNodes), each derived from a Day-0 baseline
// (fixed per-instance platform services below) plus Day-N CPU/RAM deltas from
// whichever of Log Management / Real-time Metrics are enabled (Software Depot /
// Identity Broker contribute 0 Day-N CPU/RAM in the live formula — disk only, and
// this app already models their disk as separate lines, see vcfmsAggregate911()'s
// comment), then CPU/RAM = nodeCount × the flat per-node tier below, disk = just the
// flat per-node-SET tier (not multiplied by node count, and deliberately NOT
// including any Day-N disk delta — see vcfmsAggregate911()). See
// core/sizing.js's vcfmsAggregate911() for the full formula, transcribed from the
// live Excel formula in 'Management Domain Sizing'!J23:M23 and
// 'Static Reference Tables'!D388:D391 (verified 2026-09-03 against one real cached
// scenario — First Instance/High Availability/Medium, Log Mgmt + RTM both Excluded
// — other combos are formula-derived from the same live formula but not
// independently re-verified against a live Excel recalculation).
export const VCFMS_911 = {
  // Per-node CPU/RAM, per-node-SET disk — keyed by InstanceModel+Availability+Size (no separator)
  worker: {
    'First InstanceSimpleSmall':                { cpu:12, ram:24, disk:2900 },
    'First InstanceHigh AvailabilitySmall':      { cpu:10, ram:16, disk:2800 },
    'First InstanceHigh AvailabilityMedium':     { cpu:12, ram:24, disk:3300 },
    'First InstanceHigh AvailabilityLarge':      { cpu:16, ram:32, disk:4002 },
    'Additional InstanceSimpleSmall':            { cpu:12, ram:24, disk:1000 },
    'Additional InstanceHigh AvailabilitySmall': { cpu:10, ram:16, disk:1000 },
    'Additional InstanceHigh AvailabilityMedium':{ cpu:12, ram:24, disk:1202 },
    'Additional InstanceHigh AvailabilityLarge': { cpu:16, ram:32, disk:1500 },
  },
  // Day-0 baseline platform services — keyed by Availability+Size. First Instance
  // sums all 7; Additional Instance sums only sddc_lcm/salt/telemetry (see the
  // 'Additional Instance' branch of the live C398/D398 formula).
  dayZero: {
    sddc_lcm:   { cpu:{SimpleSmall:2,   'High AvailabilitySmall':2.5,  'High AvailabilityMedium':2.5, 'High AvailabilityLarge':2.5},
                  ram:{SimpleSmall:3,   'High AvailabilitySmall':3.5,  'High AvailabilityMedium':3.5, 'High AvailabilityLarge':3.5} },
    salt:       { cpu:{SimpleSmall:0.7, 'High AvailabilitySmall':0.7,  'High AvailabilityMedium':1.5, 'High AvailabilityLarge':2.5},
                  ram:{SimpleSmall:1.5, 'High AvailabilitySmall':1.5,  'High AvailabilityMedium':2.5, 'High AvailabilityLarge':4.5} },
    salt_raas:  { cpu:{SimpleSmall:1.15,'High AvailabilitySmall':1.15,'High AvailabilityMedium':4.5, 'High AvailabilityLarge':7},
                  ram:{SimpleSmall:2.6, 'High AvailabilitySmall':2.6,  'High AvailabilityMedium':6,   'High AvailabilityLarge':9} },
    telemetry:  { cpu:{SimpleSmall:0.5, 'High AvailabilitySmall':0.5,  'High AvailabilityMedium':1,   'High AvailabilityLarge':1},
                  ram:{SimpleSmall:2,   'High AvailabilitySmall':2,    'High AvailabilityMedium':3,   'High AvailabilityLarge':6} },
    fleet:      { cpu:{SimpleSmall:2,   'High AvailabilitySmall':2.5,  'High AvailabilityMedium':2.5, 'High AvailabilityLarge':2.5},
                  ram:{SimpleSmall:3,   'High AvailabilitySmall':3.5,  'High AvailabilityMedium':3.5, 'High AvailabilityLarge':3.5} },
    // Identity Broker / Software Depot Day-0 CPU/RAM are 0 in the live formula.
    // Their own disk deltas (idbroker_disk/software_depot_disk in the live formula,
    // Additional-Instance-only) are deliberately NOT reproduced here — this app
    // already models Identity Broker / Software Depot as separate, independently
    // toggled breakdown rows (LT.identity_broker / LT.software_depot in
    // core/sizing.js's calcRawDisk) for both workbook versions; folding the Excel
    // formula's own delta in here too would double-count it on top of those.
  },
  // Day-N delta tables (optional components' capacity contribution to node count —
  // NOT added to worker.disk directly, see vcfmsAggregate911()'s comment for why).
  logman: { cpu:{Small:8, Medium:16, Large:32}, ram:{Small:16, Medium:32, Large:64}, disk:{Small:575, Medium:575, Large:575} },
  // Real-time Metrics — keyed by DeploymentModel(Simple/High Availability)+Size; disk is flat 205
  rtm: { cpu:{SimpleSmall:16, 'High AvailabilitySmall':16, 'High AvailabilityMedium':31, 'High AvailabilityLarge':47},
         ram:{SimpleSmall:20, 'High AvailabilitySmall':20, 'High AvailabilityMedium':41, 'High AvailabilityLarge':62},
         disk: 205 },
}

// Canonical subnet mask list (from Static Reference Tables 'table_masks' named range)
export const SUBNET_MASKS = [
  '255.255.255.255','255.255.255.254','255.255.255.252','255.255.255.248',
  '255.255.255.240','255.255.255.224','255.255.255.192','255.255.255.128',
  '255.255.255.0','255.255.254.0','255.255.252.0','255.255.248.0',
  '255.255.240.0','255.255.224.0','255.255.192.0','255.255.128.0',
  '255.255.0.0','255.254.0.0','255.252.0.0','255.248.0.0',
  '255.240.0.0','255.224.0.0','255.192.0.0','255.128.0.0',
  '255.0.0.0','254.0.0.0','252.0.0.0','248.0.0.0',
  '240.0.0.0','224.0.0.0','192.0.0.0','128.0.0.0','0.0.0.0',
]
