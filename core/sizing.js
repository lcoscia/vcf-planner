// Management Domain sizing calculator — pure functions.
// Transformed verbatim from the Alpine methods in index.html: every `this.sizing`
// became the explicit `s` parameter and every `this.x()` an in-module call. No DOM
// or Alpine coupling. Formulas mirror the official Excel "Management Domain Sizing"
// sheet (rows R8, R15–R21). Verified by mcp/test/scenarios.test.js.
import { LT } from './data.js'

// Aggregate VCFMS Control + Worker node specs based on instanceProfileSize
// (Small/Medium/Large), clusterModel (Simple -> 1 control node, High Availability
// -> 3 control nodes) and vcfInstanceModel (First/Additional Instance, which affects
// worker node count and adds an extra worker disk allotment per Excel J21/M21).
export function vcfmsAggregate(s) {
  const size = s.instanceProfileSize
  const im = s.vcfInstanceModel || 'First Instance'
  const ctrlNodes = s.clusterModel === 'Simple' ? LT.vcfms_control_nodes['Simple'] : LT.vcfms_control_nodes['High Availability']
  const ctrlTier = LT.vcfms_control_node[size] || LT.vcfms_control_node['Medium']
  let workerNodes
  if (im === 'Additional Instance') {
    workerNodes = size === 'Large' ? 3 : 2
  } else if (s.clusterModel === 'Simple') {
    workerNodes = 3
  } else {
    workerNodes = LT.vcfms_worker_nodes[size] || LT.vcfms_worker_nodes['Medium']
  }
  const workerTier = LT.vcfms_worker_node[size] || LT.vcfms_worker_node['Medium']
  const extraDisk = LT.vcfms_extra_disk[im]?.[size] || 0
  return {
    vcpu: ctrlTier.vcpu*ctrlNodes + workerTier.vcpu*workerNodes,
    ram:  ctrlTier.ram*ctrlNodes  + workerTier.ram*workerNodes,
    disk: ctrlTier.disk*ctrlNodes + workerTier.disk*workerNodes + extraDisk,
    ctrlNodes, workerNodes,
  }
}

// Log Management (Excel "Management Domain Sizing" row 26):
//  nodes = replicas (×2 when size = Large); replicas: min 1 (Small) / 3 (Medium, Large), max 19
//  CPU/RAM per node = VCFMS worker tier of the selected size; disk = replicas × 575 (vRLI disk)
export function logMgmtAggregate(s) {
  const size = s.compSizes.vcf_logs
  const minReplicas = size === 'Small' ? 1 : 3
  const replicas = Math.min(19, Math.max(minReplicas, parseInt(s.logReplicaCount) || minReplicas))
  const nodes = size === 'Large' ? 2 * replicas : replicas
  const tier = LT.vcfms_worker_node[size] || LT.vcfms_worker_node['Medium']
  return { vcpu: nodes*tier.vcpu, ram: nodes*tier.ram, disk: replicas*LT.vrli_disk, nodes, replicas }
}

// Real-time Metrics (Excel row 29): 2 nodes (Small/Medium Instance Profile) or 3 (Large),
// CPU/RAM per node = VCFMS worker tier of the Instance Profile Size, flat 205 GB disk
export function rtMetricsAggregate(s) {
  const size = s.instanceProfileSize
  const nodes = size === 'Large' ? 3 : 2
  const tier = LT.vcfms_worker_node[size] || LT.vcfms_worker_node['Medium']
  return { vcpu: nodes*tier.vcpu, ram: nodes*tier.ram, disk: LT.realtime_metrics_disk, nodes }
}

// VCF Automation node count (Excel J25): 1 node for Small, 3 for Medium/Large
export function vcfaNodes(s) {
  return s.compSizes.vcfa === 'Small' ? 1 : 3
}

export function calcRawCPU(s) {
  const c = s.components; const cs = s.compSizes; let t = 0
  if (c.sddc_manager) t += LT.sddc_manager.vcpu
  if (c.vcenter)      t += LT.vcenter[cs.vcenter]?.vcpu || 0
  if (c.nsx_manager)  t += (LT.nsx_manager[cs.nsx_manager]?.vcpu || 0) * (cs.nsx_manager_model==='Mandatory - Single Node' ? 1 : 3)
  if (c.nsx_edge)     t += (LT.nsx_edge[cs.nsx_edge]?.vcpu || 0) * 2
  if (c.vcf_operations) t += LT.vcf_operations[cs.vcf_operations]?.vcpu || 0
  if (c.vcf_logs)     t += logMgmtAggregate(s).vcpu
  if (c.avi_lb)       t += (LT.avi_lb[cs.avi_lb]?.vcpu || 0) * 3
  if (c.vcfa)         t += (LT.vcfa[cs.vcfa]?.vcpu || 0) * vcfaNodes(s)
  if (c.ssp)          t += LT.ssp[cs.ssp]?.vcpu || 0
  if (c.ssp && cs.ssp !== 'Excluded') t += LT.ssp_license.vcpu
  if (c.vcf_svc_runtime)            t += vcfmsAggregate(s).vcpu
  if (c.cloud_proxy)                t += LT.vcfops_proxy[cs.cloud_proxy]?.vcpu || LT.cloud_proxy.vcpu
  if (c.license_server)             t += LT.license_server.vcpu
  if (c.vcf_ops_networks)           t += LT.vcf_ops_networks[cs.vcf_ops_networks]?.vcpu || 0
  if (c.vcf_ops_networks_collector) t += LT.vcf_ops_networks_collector[cs.vcf_ops_networks_collector]?.vcpu || 0
  if (c.realtime_metrics)           t += rtMetricsAggregate(s).vcpu
  // identity_broker: Excel counts only its disk (CPU/RAM are "N/A", excluded from every sum)
  if (c.software_depot)             t += LT.software_depot.vcpu
  if (c.vrms)                       t += LT.vrms[cs.vrms]?.vcpu || 0
  if (c.srm)                        t += LT.srm[cs.srm]?.vcpu || 0
  if (c.hvm)                        t += LT.hvm.vcpu
  if (c.cloud_ransomware)           t += LT.cloud_ransomware.vcpu
  if (c.hcx_connector)              t += LT.hcx_connector.vcpu
  // Per WLD: add 1 vCenter Small + 3 NSX Manager Small (if NSX enabled)
  const wldVcpuPerDomain = (LT.wld_vcenter[cs.wldVcSize || 'Small'].vcpu) + (c.nsx_manager ? LT.nsx_manager['Small'].vcpu * 3 : 0)
  t += wldVcpuPerDomain * (s.wldCount || 0)
  return t
}

// Excel ROUNDUP() equivalent — subtracts a tiny epsilon before Math.ceil() so
// floating-point artifacts (e.g. 14360*1.1 === 15796.000000000002) don't push an
// exact integer result up to the next integer.
export function roundUp(x) {
  return Math.ceil(x - 1e-9)
}

export function calcTotalCPU(s) {
  const raw = calcRawCPU(s)
  return roundUp(raw * (1 + (s.opsReservePct||30)/100))
}

export function calcRawRAM(s) {
  const c = s.components; const cs = s.compSizes; let t = 0
  if (c.sddc_manager) t += LT.sddc_manager.ram
  if (c.vcenter)      t += LT.vcenter[cs.vcenter]?.ram || 0
  if (c.nsx_manager)  t += (LT.nsx_manager[cs.nsx_manager]?.ram || 0) * (cs.nsx_manager_model==='Mandatory - Single Node' ? 1 : 3)
  if (c.nsx_edge)     t += (LT.nsx_edge[cs.nsx_edge]?.ram || 0) * 2
  if (c.vcf_operations) t += LT.vcf_operations[cs.vcf_operations]?.ram || 0
  if (c.vcf_logs)     t += logMgmtAggregate(s).ram
  if (c.avi_lb)       t += (LT.avi_lb[cs.avi_lb]?.ram || 0) * 3
  if (c.vcfa)         t += (LT.vcfa[cs.vcfa]?.ram || 0) * vcfaNodes(s)
  if (c.ssp)          t += LT.ssp[cs.ssp]?.ram || 0
  if (c.ssp && cs.ssp !== 'Excluded') t += LT.ssp_license.ram
  if (c.vcf_svc_runtime)            t += vcfmsAggregate(s).ram
  if (c.cloud_proxy)                t += LT.vcfops_proxy[cs.cloud_proxy]?.ram || LT.cloud_proxy.ram
  if (c.license_server)             t += LT.license_server.ram
  if (c.vcf_ops_networks)           t += LT.vcf_ops_networks[cs.vcf_ops_networks]?.ram || 0
  if (c.vcf_ops_networks_collector) t += LT.vcf_ops_networks_collector[cs.vcf_ops_networks_collector]?.ram || 0
  if (c.realtime_metrics)           t += rtMetricsAggregate(s).ram
  // identity_broker: Excel counts only its disk (CPU/RAM are "N/A", excluded from every sum)
  if (c.software_depot)             t += LT.software_depot.ram
  if (c.vrms)                       t += LT.vrms[cs.vrms]?.ram || 0
  if (c.srm)                        t += LT.srm[cs.srm]?.ram || 0
  if (c.hvm)                        t += LT.hvm.ram
  if (c.cloud_ransomware)           t += LT.cloud_ransomware.ram
  if (c.hcx_connector)              t += LT.hcx_connector.ram
  // Per WLD: add 1 vCenter Small + 3 NSX Manager Small (if NSX enabled)
  const wldRamPerDomain = (LT.wld_vcenter[cs.wldVcSize || 'Small'].ram) + (c.nsx_manager ? LT.nsx_manager['Small'].ram * 3 : 0)
  t += wldRamPerDomain * (s.wldCount || 0)
  return t
}

export function calcTotalRAM(s) {
  return roundUp(calcRawRAM(s) * (1 + (s.opsReservePct||30)/100))
}

export function calcRawDisk(s) {
  const c = s.components; const cs = s.compSizes; let t = 0
  if (c.sddc_manager) t += LT.sddc_manager.disk
  if (c.vcenter)      t += LT.vcenter_disk_tiers[cs.vcenter]?.[cs.vcenterStorage] ?? LT.vcenter[cs.vcenter]?.disk ?? 0
  if (c.nsx_manager)  t += (LT.nsx_manager[cs.nsx_manager]?.disk || 0) * (cs.nsx_manager_model==='Mandatory - Single Node' ? 1 : 3)
  if (c.nsx_edge)     t += (LT.nsx_edge[cs.nsx_edge]?.disk || 0) * 2
  if (c.vcf_operations) t += LT.vcf_operations[cs.vcf_operations]?.disk || 0
  if (c.vcf_logs)     t += logMgmtAggregate(s).disk
  if (c.avi_lb)       t += (LT.avi_lb[cs.avi_lb]?.disk || 0) * 3
  if (c.vcfa)         t += (LT.vcfa[cs.vcfa]?.disk || 0) * vcfaNodes(s)
  if (c.ssp)          t += LT.ssp[cs.ssp]?.disk || 0
  if (c.ssp && cs.ssp !== 'Excluded') t += LT.ssp_license.disk
  if (c.vcf_svc_runtime)            t += vcfmsAggregate(s).disk
  if (c.cloud_proxy)                t += LT.vcfops_proxy[cs.cloud_proxy]?.disk || LT.cloud_proxy.disk
  if (c.license_server)             t += LT.license_server.disk
  if (c.vcf_ops_networks)           t += LT.vcf_ops_networks[cs.vcf_ops_networks]?.disk || 0
  if (c.vcf_ops_networks_collector) t += LT.vcf_ops_networks_collector[cs.vcf_ops_networks_collector]?.disk || 0
  if (c.realtime_metrics)           t += rtMetricsAggregate(s).disk
  if (c.identity_broker)            t += LT.identity_broker[cs.identity_broker]?.disk || 0
  if (c.software_depot)             t += LT.software_depot.disk
  if (c.vrms)                       t += LT.vrms[cs.vrms]?.disk || 0
  if (c.srm)                        t += LT.srm[cs.srm]?.disk || 0
  if (c.hvm)                        t += LT.hvm.disk
  if (c.cloud_ransomware)           t += LT.cloud_ransomware.disk
  if (c.hcx_connector)              t += LT.hcx_connector.disk
  return t
}

// Disk sizing chain, following the Excel "Management Domain Sizing" rows R15-R20:
//  R15 Virtual Machine Capacity      = calcRawDisk()
//  R16 Swap File Requirements        = calcRawRAM()
//  R17 Interim Total                 = R15 + R16
//  R18 Redundancy (FTT1)             = ROUNDUP(R17 * (vSAN-ESA ? 1.5 : 2.0))   [vSAN only — FC/NFS skip R18+R19]
//  R19 Host Rebuild + Ops Reserve    = ROUNDUP(R18 * (1 + opsReservePct/100))
//  R20 Estimated Growth (=calcTotalDisk):
//      FC/NFS  -> ROUNDUP(R17 * (1 + growthPct/100))
//      other   -> ROUNDUP(R19 * (1 + growthPct/100))
export function calcTotalDisk(s) {
  const r15 = calcRawDisk(s)
  const r16 = calcRawRAM(s)
  const r17 = r15 + r16
  const isFcOrNfs = s.storageType === 'VMFS on Fibre Channel (FC)' || s.storageType === 'NFSv3'
  if (isFcOrNfs) {
    return roundUp(r17 * (1 + (s.growthPct||10)/100))
  }
  const overhead = s.storageType === 'vSAN-ESA' ? 1.5 : 2.0
  const r18 = roundUp(r17 * overhead)
  const r19 = roundUp(r18 * (1 + (s.opsReservePct||30)/100))
  return roundUp(r19 * (1 + (s.growthPct||10)/100))
}

export function calcHosts(s) {
  if (!s.hostCores || !s.hostRAM) return '—'
  const overSub = parseFloat(s.cpuOverSub) || 1
  const rawCPU = calcRawCPU(s)
  const rawRAM = calcRawRAM(s)
  const byCpu = roundUp(rawCPU / overSub / s.hostCores)
  const byRam = roundUp(rawRAM / s.hostRAM) + 1
  const isVsan = s.storageType && s.storageType.startsWith('vSAN')
  // Excel R8 floors: HA -> 4 hosts; otherwise vSAN -> 3 (quorum), non-vSAN -> 2.
  // The vSAN floor applies even for the Simple deployment model (no min-1 path in Excel).
  const min = s.clusterModel === 'High Availability (Three-Node)' ? 4
            : isVsan ? 3
            : 2
  return Math.max(min, byCpu, byRam)
}

export function calcHostsSafe(s) {
  const h = calcHosts(s)
  return (typeof h === 'number' && h > 0) ? h : 0
}

export function calcDiskPerHost(s) {
  const hosts = calcHosts(s)
  if (hosts === '—' || typeof hosts !== 'number') return '—'
  const total = calcTotalDisk(s)
  // Excel R21: storage per host = total / (hosts - 1); hosts is always >= 2 (see calcHosts floors)
  return roundUp(total / (hosts - 1))
}

export function sizingBreakdown(s) {
  const c = s.components; const cs = s.compSizes
  const rows = [
    { name:'SDDC Manager',      excluded:!c.sddc_manager, vcpu:LT.sddc_manager.vcpu, ram:LT.sddc_manager.ram, disk:LT.sddc_manager.disk },
    { name:`vCenter (${cs.vcenter}, ${cs.vcenterStorage} storage)`, excluded:!c.vcenter,
      ...( LT.vcenter[cs.vcenter] || {vcpu:0,ram:0,disk:0}),
      disk: LT.vcenter_disk_tiers[cs.vcenter]?.[cs.vcenterStorage] ?? LT.vcenter[cs.vcenter]?.disk ?? 0 },
    { name:`NSX Manager ×${cs.nsx_manager_model==='Mandatory - Single Node'?1:3} (${cs.nsx_manager})`, excluded:!c.nsx_manager,
      vcpu:(LT.nsx_manager[cs.nsx_manager]?.vcpu||0)*(cs.nsx_manager_model==='Mandatory - Single Node'?1:3),
      ram:(LT.nsx_manager[cs.nsx_manager]?.ram||0)*(cs.nsx_manager_model==='Mandatory - Single Node'?1:3),
      disk:(LT.nsx_manager[cs.nsx_manager]?.disk||0)*(cs.nsx_manager_model==='Mandatory - Single Node'?1:3) },
    { name:`NSX Edge ×2 (${cs.nsx_edge})`, excluded:!c.nsx_edge,
      vcpu:(LT.nsx_edge[cs.nsx_edge]?.vcpu||0)*2, ram:(LT.nsx_edge[cs.nsx_edge]?.ram||0)*2, disk:(LT.nsx_edge[cs.nsx_edge]?.disk||0)*2 },
    { name:`VCF Operations (${cs.vcf_operations})`, excluded:!c.vcf_operations, ...(LT.vcf_operations[cs.vcf_operations]||{vcpu:0,ram:0,disk:0}) },
    { name:`Log Management (${cs.vcf_logs}, ${logMgmtAggregate(s).replicas} replica(s) → ×${logMgmtAggregate(s).nodes})`, excluded:!c.vcf_logs,
      ...(({vcpu,ram,disk})=>({vcpu,ram,disk}))(logMgmtAggregate(s)) },
    { name:`AVI LB ×3 (${cs.avi_lb})`, excluded:!c.avi_lb,
      vcpu:(LT.avi_lb[cs.avi_lb]?.vcpu||0)*3, ram:(LT.avi_lb[cs.avi_lb]?.ram||0)*3, disk:(LT.avi_lb[cs.avi_lb]?.disk||0)*3 },
    { name:`VCF Automation (VCFA ${cs.vcfa} ×${vcfaNodes(s)})`, excluded:!c.vcfa,
      vcpu:(LT.vcfa[cs.vcfa]?.vcpu||0)*vcfaNodes(s), ram:(LT.vcfa[cs.vcfa]?.ram||0)*vcfaNodes(s), disk:(LT.vcfa[cs.vcfa]?.disk||0)*vcfaNodes(s) },
    { name:`vDefend SSP (${cs.ssp})`, excluded:!c.ssp, ...(LT.ssp[cs.ssp]||{vcpu:0,ram:0,disk:0}) },
    { name:'vDefend/AVI Licensing Hub', excluded:!(c.ssp && cs.ssp !== 'Excluded'), ...LT.ssp_license },
    { name:`VCF Services Runtime (Control ×${vcfmsAggregate(s).ctrlNodes} + Worker ×${vcfmsAggregate(s).workerNodes})`, excluded:!c.vcf_svc_runtime,
      ...(({vcpu,ram,disk})=>({vcpu,ram,disk}))(vcfmsAggregate(s)) },
    { name:`Cloud Proxy (${cs.cloud_proxy})`, excluded:!c.cloud_proxy, ...(LT.vcfops_proxy[cs.cloud_proxy] || LT.cloud_proxy) },
    { name:'License Server', excluded:!c.license_server, ...LT.license_server },
    { name:`VCF Operations for Networks (${cs.vcf_ops_networks})`, excluded:!c.vcf_ops_networks, ...(LT.vcf_ops_networks[cs.vcf_ops_networks]||{vcpu:0,ram:0,disk:0}) },
    { name:`VCF Operations for Networks — Collector (${cs.vcf_ops_networks_collector})`, excluded:!c.vcf_ops_networks_collector, ...(LT.vcf_ops_networks_collector[cs.vcf_ops_networks_collector]||{vcpu:0,ram:0,disk:0}) },
    { name:`Real-time Metrics ×${rtMetricsAggregate(s).nodes}`, excluded:!c.realtime_metrics,
      ...(({vcpu,ram,disk})=>({vcpu,ram,disk}))(rtMetricsAggregate(s)) },
    { name:`Identity Broker (Additional Instance) (${cs.identity_broker} — disk only)`, excluded:!c.identity_broker,
      vcpu:0, ram:0, disk:LT.identity_broker[cs.identity_broker]?.disk || 0 },
    { name:'Software Depot (Additional Instance)', excluded:!c.software_depot, ...LT.software_depot },
    { name:`VRMS (vSphere Replication) (${cs.vrms})`, excluded:!c.vrms, ...(LT.vrms[cs.vrms]||{vcpu:0,ram:0,disk:0}) },
    { name:`SRM (Site Recovery Manager) (${cs.srm})`, excluded:!c.srm, ...(LT.srm[cs.srm]||{vcpu:0,ram:0,disk:0}) },
    { name:'Health Reporting and Monitoring (HVM)', excluded:!c.hvm, ...LT.hvm },
    { name:'Cloud-Based Ransomware Recovery', excluded:!c.cloud_ransomware, ...LT.cloud_ransomware },
    { name:'HCX Connector (Cross-Cloud Mobility)', excluded:!c.hcx_connector, ...LT.hcx_connector },
  ]
  return rows
}

// Convenience aggregator for the MCP server: one call returns every headline figure.
export function computeSizing(s) {
  return {
    hostCount: calcHostsSafe(s),
    hostCountRaw: calcHosts(s),
    rawCPU: calcRawCPU(s),
    rawRAM: calcRawRAM(s),
    rawDisk: calcRawDisk(s),
    totalCPU: calcTotalCPU(s),
    totalRAM: calcTotalRAM(s),
    totalDisk: calcTotalDisk(s),
    diskPerHost: calcDiskPerHost(s),
    breakdown: sizingBreakdown(s),
  }
}
