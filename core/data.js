// Static reference tables for VCF 9.1 sizing — extracted verbatim from index.html.
// Verified against the official Excel "Static Reference Tables" sheet by tools/check_lt_constants.py.
export const LT = {
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
