// Import of a "VCF Network Planner" project JSON (github.com/lcoscia — sibling tool,
// "Export JSON" → vcf9_plan_YYYY-MM-DD.json) into the P&P form.
//
// NP export shape (v1.29.0): { project, managementDomain, workloadDomains[], vlans[],
// appliances[], vips[], hosts[] } — no meta/version block. Only non-empty NP values are
// applied; everything NP has no equivalent for is listed in the report. The mapping
// table is documented in README.md ("Import a VCF Network Planner JSON").
// Pure module (no DOM/Alpine): returns a report shaped like core/excel-import.js's
// ({ applied, skipped, ambiguous } with sheet/cell → here 'NP' / JSON path).
import { SCALE_VSAN_STRETCHED, SCALE_VMSC } from './reference.js'

// NP v1.31.0+ exports carry meta:{tool:'VCF Network Planner', version, schema:1, exported};
// older exports are recognised by their shape.
export function isNetworkPlannerExport(d) {
  if (!d || typeof d !== 'object' || d.form) return false
  if (d.meta && d.meta.tool === 'VCF Network Planner') return true
  return !!(d.project && d.managementDomain && Array.isArray(d.vlans) && Array.isArray(d.appliances))
}

const STORAGE = { 'vsan-esa':'vSAN-ESA', 'vsan-osa':'vSAN-OSA', 'vmfs':'VMFS on Fibre Channel (FC)', 'nfs':'NFSv3' }
const VERSION = { '9.1':'9.1.0.0', '9.1.0':'9.1.0.0', '9.1.1':'9.1.1.0' }

// NP vlanName (domain 'Management Domain') -> P&P makeNetFields prefix (+ whether it has a pool)
const MGMT_VLANS = [
  [/^ESXi Management( — AZ1)?$/,            'esxMgmt',   false],
  [/^Management VM Network$/,               'vmMgmt',    false],
  [/^VCF Management Services Runtime$/,     'vcfMgmt',   false],
  [/^vMotion( — AZ1)?$/,                    'vmotion',   true],
  [/^vSAN( — AZ1)?$/,                       'vsan1',     true],
  [/^NSX Host TEP( — AZ1)?$/,               'overlay',   true],
  [/^NFS Storage$/,                         'nfs',       true],
  [/^ESXi Management — AZ2$/,               'az2EsxMgmt', false],
  [/^vMotion — AZ2$/,                       'az2Vmotion', true],
  [/^vSAN — AZ2$/,                          'az2Vsan',    true],
]
const WLD_VLANS = [
  [/^ESXi Management( — AZ1)?$/,     'wldEsxMgmt', true],
  [/^VM \/ Application Network$/,    'wldVmMgmt',  true],
  [/^vMotion( — AZ1)?$/,             'wldVmotion', true],
  [/^vSAN( — AZ1)?$/,                'wldVsan',    true],
  [/^NSX Host TEP( — AZ1)?$/,        'wldOverlay', true],
  [/^NFS Storage$/,                  'wldNfs',     false],
]

// NP applianceName / vipName -> [P&P fqdn key, P&P ip key]
const APPLIANCES = {
  'sddc-manager-01':            ['vcfSddcFqdn', 'vcfSddcIp'],
  'vcenter-mgmt-01':            ['vcMgmtFqdn', 'vcMgmtIp'],
  'nsx-manager-mgmt-01':        ['nsxMgr1Fqdn', 'nsxMgr1Ip'],
  'nsx-manager-mgmt-02':        ['nsxMgr2Fqdn', 'nsxMgr2Ip'],
  'nsx-manager-mgmt-03':        ['nsxMgr3Fqdn', 'nsxMgr3Ip'],
  'nsx-edge-mgmt-01':           ['nsxEdge1Fqdn', 'nsxEdge1Ip'],
  'nsx-edge-mgmt-02':           ['nsxEdge2Fqdn', 'nsxEdge2Ip'],
  'vcf-ops-01':                 ['vcfOpsPrimaryFqdn', 'vcfOpsPrimaryIp'],
  'vcf-ops-02':                 ['vcfOpsReplicaFqdn', 'vcfOpsReplicaIp'],
  'vcf-ops-03':                 ['vcfOpsDataFqdn', 'vcfOpsDataIp'],
  'vcf-ops-cloud-proxy-01':     ['vcfOpsCollectorFqdn', 'vcfOpsCollectorIp'],   // single Cloud Proxy (Collector) entry in P&P
  'vcf-ops-rc-01':              ['vcfOpsCollectorFqdn', 'vcfOpsCollectorIp'],
  'fleet-01':                   ['fleetComponentsFqdn', 'fleetComponentsIp'],
  'mgmt-instance-01':           ['instanceComponentsFqdn', 'instanceComponentsIp'],
  'vcf-svc-runtime':            ['vcfSvcRuntimeFqdn', 'vcfSvcRuntimeIp'],
  'vcf-license-server-01':      ['licenseServerFqdn', 'licenseServerIp'],
  'vcf-identity-broker-01':     ['idBrokerFqdn', 'idBrokerIp'],
  'vcf-automation-01':          ['vcfAutoFqdn', 'vcfAutoIp'],
  'vcf-automation-svcruntime-01': ['vcfAutoSvcRuntimeFqdn', 'vcfAutoSvcRuntimeIp'],
  'vcf-nets-platform-01':       ['vcfNetOpsFqdn', 'vcfNetOpsPlatformIpv4'],
  'vcf-nets-collector-01':      [null, 'vcfNetOpsCollectorIpv4'],
  'vsan-witness-mgmt':          ['vsanWitnessHost', 'vsanWitnessIp'],
  'avi-controller-01':          ['aviCtrl1Fqdn', 'aviCtrl1Ip'],
  'avi-controller-02':          ['aviCtrl2Fqdn', 'aviCtrl2Ip'],
  'avi-controller-03':          ['aviCtrl3Fqdn', 'aviCtrl3Ip'],
  'vcenter-wld-01-01':          ['wldVcFqdn', 'wldVcIp'],
}
const VIPS = {
  'NSX Manager VIP':            ['nsxVipFqdn', 'nsxVipIp'],
  'VCF Operations VIP':         ['vcfOpsLbFqdn', 'vcfOpsLbIp'],
  'VCF Log Management VIP':     ['vcfLogsFqdn', 'vcfLogsIp'],
  'VCF Automation VIP':         ['vcfAutoFqdn', 'vcfAutoIp'],
  'AVI Controller Cluster VIP': ['aviClusterFqdn', 'aviClusterIp'],
  'WLD-01 NSX Manager VIP':     ['wldNsxVipFqdn', 'wldNsxVipIp'],
}


export function applyNetworkPlannerJson(d, form) {
  const meta = (d.meta && typeof d.meta === 'object') ? d.meta : null
  const report = {
    source: 'VCF Network Planner JSON' + (meta ? ` (${meta.version || 'unknown version'}, schema ${meta.schema ?? '?'})` : ' (pre-v1.31.0, no meta)'),
    meta, applied:[], skipped:[], ambiguous:[],
  }
  if (meta && Number(meta.schema) > 1) report.ambiguous.push({ key:'—', sheet:'NP', cell:'meta.schema', rawValue:String(meta.schema), reason:'newer NP export schema than this importer knows (1) — unknown fields are ignored, check the result' })
  d.vlans = Array.isArray(d.vlans) ? d.vlans : []
  d.appliances = Array.isArray(d.appliances) ? d.appliances : []
  const has = v => v !== undefined && v !== null && String(v).trim() !== ''
  const set = (key, val, path) => {
    if (!key || !has(val)) return false
    form[key] = String(val).trim()
    report.applied.push({ key, sheet:'NP', cell:path, value:String(val) })
    return true
  }
  const setIfEmpty = (key, val, path, why) => {
    if (!has(val)) return
    if (has(form[key])) { report.skipped.push({ key, sheet:'NP', cell:path, reason:`kept your existing value "${form[key]}" (${why})` }); return }
    set(key, val, path)
    report.ambiguous.push({ key, sheet:'NP', cell:path, rawValue:String(val), reason:why })
  }
  const skip = (path, reason, key='—') => report.skipped.push({ key, sheet:'NP', cell:path, reason })

  const project = d.project || {}
  const mgmt = d.managementDomain || {}

  // ── Project / global ──
  if (has(project.vcfVersion)) {
    if (VERSION[project.vcfVersion]) set('vcfVersion', VERSION[project.vcfVersion], 'project.vcfVersion')
    else skip('project.vcfVersion', `VCF ${project.vcfVersion} has no P&P equivalent (9.1.x only)`, 'vcfVersion')
  }
  const isVvf = /^vvf/i.test(project.scenario || '')
  set('deploymentType', isVvf ? 'VMware vSphere Foundation' : 'VMware Cloud Foundation', 'project.scenario')
  if (!has(form.deploymentMode)) set('deploymentMode', isVvf ? 'New VVF Fleet' : 'New VCF Fleet', 'project.deploymentType')
  const suffix = String(project.fqdnSuffix || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  const lc = v => String(v || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  // NP v1.31.0+: explicit site code / instance / parent domain (workbook FQDN convention)
  const siteCode = lc(project.siteCode), instanceName = lc(project.instanceName), parentDomain = lc(project.parentDomain)
  if (siteCode) set('deploymentRegion', siteCode, 'project.siteCode')   // primarySiteName mirrors it (index.html syncDerivedForm)
  if (instanceName) set('deploymentInstance', instanceName, 'project.instanceName')
  if (parentDomain) set('domainName', parentDomain, 'project.parentDomain')
  if (suffix) set('subDomainName', suffix, 'project.fqdnSuffix')
  else if (siteCode && parentDomain) set('subDomainName', `${siteCode}.${parentDomain}`, 'project.siteCode + project.parentDomain')
  // Fallback for NP exports older than v1.31.0 (no siteCode / parentDomain): derive from fqdnSuffix
  if (suffix && (!parentDomain || !siteCode)) {
    const labels = suffix.split('.')
    if (labels.length >= 3) {
      if (!parentDomain) setIfEmpty('domainName', labels.slice(1).join('.'), 'project.fqdnSuffix', 'DNS Domain Name derived from the NP FQDN suffix by dropping its first label — check it')
      if (!siteCode && /^[a-z0-9]{2,5}$/.test(labels[0])) setIfEmpty('deploymentRegion', labels[0], 'project.fqdnSuffix', 'Region / Site Code derived from the first label of the NP FQDN suffix — check it')
    } else if (!parentDomain) {
      setIfEmpty('domainName', suffix, 'project.fqdnSuffix', 'NP FQDN suffix has no child zone — used as DNS Domain Name')
    }
  }
  if (has(project.fqdnPrefix) && (!siteCode || !instanceName)) {
    const m = String(project.fqdnPrefix).toLowerCase().match(/^([a-z0-9]{2,5})-([a-z][0-9]{2})$/)
    if (m) { if (!siteCode) setIfEmpty('deploymentRegion', m[1], 'project.fqdnPrefix', 'Site code split from the NP FQDN prefix'); if (!instanceName) setIfEmpty('deploymentInstance', m[2], 'project.fqdnPrefix', 'Instance name split from the NP FQDN prefix') }
    else skip('project.fqdnPrefix', `free-text NP prefix "${project.fqdnPrefix}" has no P&P field (FQDNs are imported as-is)`)
  }
  // DNS / NTP servers (NP v1.31.0+) — P&P has 2 of each
  const list = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(x => String(x).trim()).filter(Boolean)
  const dns = list(project.dnsServers), ntp = list(project.ntpServers)
  dns.slice(0, 2).forEach((x, i) => set(`dnsServer${i + 1}`, x, `project.dnsServers[${i}]`))
  ntp.slice(0, 2).forEach((x, i) => set(`ntpServer${i + 1}`, x, `project.ntpServers[${i}]`))
  if (dns.length > 2) skip('project.dnsServers[2..]', `${dns.length - 2} extra DNS server(s) — P&P has 2 DNS fields`)
  if (ntp.length > 2) skip('project.ntpServers[2..]', `${ntp.length - 2} extra NTP server(s) — P&P has 2 NTP fields`)

  // ── Management domain topology ──
  const topo = mgmt.topologyMode || 'single-site'
  const stretched = topo === 'vsan-stretched' || topo === 'stretched'
  const az1 = Number(stretched ? mgmt.az1HostCount : mgmt.hostCount) || 0
  const az2 = stretched ? (Number(mgmt.az2HostCount) || 0) : 0
  if (topo === 'vsan-stretched') { set('deploymentScale', SCALE_VSAN_STRETCHED, 'managementDomain.topologyMode'); set('vsanStretchInclude', 'Include', 'managementDomain.topologyMode') }
  else if (topo === 'stretched') { set('deploymentScale', SCALE_VMSC, 'managementDomain.topologyMode'); set('vsanStretchInclude', 'Exclude', 'managementDomain.topologyMode') }
  else if (!has(form.deploymentScale) && !isVvf) set('deploymentScale', az1 === 3 ? 'Consolidated (3 hosts — lab only)' : 'Standard (4+ hosts)', 'managementDomain.hostCount')
  if (az1) set('mgmtHostCount', az1, stretched ? 'managementDomain.az1HostCount' : 'managementDomain.hostCount')
  if (az2) set('mgmtAz2HostCount', az2, 'managementDomain.az2HostCount')
  if (topo === 'vsan-stretched' && mgmt.azNetworks) {
    const st = Object.entries(mgmt.azNetworks).filter(([, v]) => v === 'stretched').map(([k]) => k)
    if (st.length) skip('managementDomain.azNetworks', `networks stretched across AZs in NP (${st.join(', ')}) — P&P only models per-AZ AZ2 networks; the AZ2 fields are left empty`)
  }
  if (STORAGE[mgmt.storageType]) set('principalStorage', STORAGE[mgmt.storageType], 'managementDomain.storageType')
  if (has(mgmt.nsxManagerMode)) set('nsxMgrCount', mgmt.nsxManagerMode === 'clustered' ? 'NSX Management Cluster (3 nodes)' : 'Single NSX Manager Appliance', 'managementDomain.nsxManagerMode')
  if (mgmt.nsxEdgeDeployed !== undefined) set('nsxEdgeInclude', mgmt.nsxEdgeDeployed ? 'Include' : 'Exclude', 'managementDomain.nsxEdgeDeployed')
  if (mgmt.nsxEdgeDeployed && Number(mgmt.nsxEdgeNodeCount) > 2) skip('managementDomain.nsxEdgeNodeCount', `${mgmt.nsxEdgeNodeCount} edges in NP — P&P models 2 edge nodes, edges 3+ are not imported`)
  if (has(mgmt.fleetPlacement)) {
    const dedicated = ['dedicated-fleet-vlan','nsx-vlan-segment','nsx-overlay-segment'].includes(mgmt.fleetPlacement)
    set('vcfMgmtInclude', dedicated ? 'Include' : 'Exclude', 'managementDomain.fleetPlacement')
    if (mgmt.fleetPlacement.startsWith('nsx-')) skip('managementDomain.fleetPlacement', `NP placement "${mgmt.fleetPlacement}" (NSX segment) has no P&P equivalent — mapped to the dedicated VCF Management network`)
  }
  const ops = mgmt.vcfOperations || {}
  if (ops.enabled !== undefined && ops.enabled) set('vcfOpsHaMode', ops.mode === 'enterprise' ? 'HA Cluster' : 'Single Node', 'managementDomain.vcfOperations.mode')
  if (ops.cloudProxyEnabled !== undefined) set('vcfOpsCollectorInclude', ops.cloudProxyEnabled ? 'Include' : 'Exclude', 'managementDomain.vcfOperations.cloudProxyEnabled')
  const logs = mgmt.vcfOperationsForLogs || {}
  if (logs.enabled !== undefined) set('vcfLogsInclude', logs.enabled ? 'Include' : 'Exclude', 'managementDomain.vcfOperationsForLogs.enabled')
  if (logs.enabled && Number(mgmt.logMgmtExtraReplicas) > 0) set('vcfLogsReplicaCount', String(Math.min(19, 1 + Number(mgmt.logMgmtExtraReplicas))), 'managementDomain.logMgmtExtraReplicas')
  const nets = mgmt.vcfOperationsForNetworks || {}
  if (nets.enabled !== undefined) set('vcfNetOpsInclude', nets.enabled ? 'Include' : 'Exclude', 'managementDomain.vcfOperationsForNetworks.enabled')
  const idb = mgmt.vcfIdentityBroker || {}
  if (idb.enabled !== undefined) set('idBrokerInclude', idb.enabled && idb.mode !== 'embedded' ? 'Include' : 'Exclude', 'managementDomain.vcfIdentityBroker')
  if (mgmt.aviDeployed !== undefined) set('aviInclude', mgmt.aviDeployed ? 'Include' : 'Exclude', 'managementDomain.aviDeployed')
  if (mgmt.vcfAutomation && mgmt.vcfAutomation.enabled) report.ambiguous.push({ key:'vcfOpsAutoMode', sheet:'NP', cell:'managementDomain.vcfAutomation.enabled', rawValue:'true', reason:'VCF Automation FQDN/IPs imported; they are shown on Fleet Management Day-N once "Deploy VCF Operations / Automation" is set' })
  if (mgmt.realtimeMetricsEnabled) skip('managementDomain.realtimeMetricsEnabled', 'Real-time Metrics is a sizing component in P&P — tick it on the Management Domain Sizing page (adds 6 IPs to the Management Services range check)')
  for (const k of ['vksEnabled','sspEnabled']) if (mgmt[k]) skip(`managementDomain.${k}`, 'no equivalent field in P&P')
  if (mgmt.vpcConnectivity === 'distributed') skip('managementDomain.vpcConnectivity', 'VPC External (Distributed Transit Gateway) VLAN has no P&P field')

  // ── Management Services / VCF Automation ranges ──
  set('vcfSvcRangeStart', mgmt.svcRuntimeRangeStart, 'managementDomain.svcRuntimeRangeStart')
  set('vcfSvcRangeEnd', mgmt.svcRuntimeRangeEnd, 'managementDomain.svcRuntimeRangeEnd')
  set('vcfAutoRangeStart', mgmt.vcfaRangeStart, 'managementDomain.vcfaRangeStart')
  set('vcfAutoRangeEnd', mgmt.vcfaRangeEnd, 'managementDomain.vcfaRangeEnd')

  // ── VLANs ──
  const wlds = Array.isArray(d.workloadDomains) ? d.workloadDomains : []
  const wld1 = wlds[0] && wlds[0].domainName
  d.vlans.forEach((v, idx) => {
    const path = `vlans[${idx}] ${v.domain} / ${v.vlanName}`
    let table = null
    if (v.domain === 'Management Domain') table = MGMT_VLANS
    else if (wld1 && v.domain === wld1) table = WLD_VLANS
    const hit = table && table.find(([re]) => re.test(v.vlanName))
    if (hit) {
      const [, pre, pool] = hit
      set(`${pre}Vlan`, v.vlanId, path + ' .vlanId')
      set(`${pre}Gateway`, v.gateway, path + ' .gateway')
      set(`${pre}Cidr`, v.cidr, path + ' .cidr')
      if (has(v.vlanId) && has(v.recommendedMTU) && !has(form[`${pre}Mtu`])) set(`${pre}Mtu`, v.recommendedMTU, path + ' .recommendedMTU')
      if (pool) { set(`${pre}IpStart`, v.rangeStart, path + ' .rangeStart'); set(`${pre}IpEnd`, v.rangeEnd, path + ' .rangeEnd') }
      return
    }
    if (v.domain === 'Management Domain') {
      if (/^NSX Host TEP — AZ2$/.test(v.vlanName)) { set('az2OverlayVlan', v.vlanId, path + ' .vlanId'); return }
      if (v.vlanName === 'NSX Edge TEP') { set('edgeTepVlan', v.vlanId, path + ' .vlanId'); set('edgeTepIpStart', v.rangeStart, path + ' .rangeStart'); set('edgeTepIpEnd', v.rangeEnd, path + ' .rangeEnd'); return }
      const up = v.vlanName.match(/^NSX Edge Uplink ([12])$/)
      if (up) { const n = up[1]; set(`nsxEdgeUplink${n}Vlan`, v.vlanId, path + ' .vlanId'); set(`edge1UplinkVlan${n}`, v.vlanId, path + ' .vlanId'); set(`edge2UplinkVlan${n}`, v.vlanId, path + ' .vlanId'); return }
    }
    if (has(v.vlanId) || has(v.cidr)) skip(path, 'no equivalent network in P&P')
  })

  // ── Hosts ──
  const az1Count = Number(mgmt.az1HostCount) || 0
  d.hosts && d.hosts.forEach((h, idx) => {
    const path = `hosts[${idx}] ${h.domain} #${h.index}${h.az ? ' ' + h.az : ''}`
    let key = null
    if (h.domain === 'Management Domain') {
      if (topo === 'vsan-stretched' && h.az === 'AZ2') key = `az2Host${Number(h.azIndex) || (h.index - az1Count)}`
      else key = `m01Host${h.index}`
    } else if (wld1 && h.domain === wld1) key = `w01Host${h.index}`
    const n = key && Number(key.match(/(\d+)$/)[1])
    if (!key || !(n >= 1 && n <= 16)) { if (has(h.fqdn) || has(h.ipAddress)) skip(path, key ? 'beyond the 16 host rows of P&P' : 'only the first workload domain is imported'); return }
    set(`${key}Fqdn`, h.fqdn, path + ' .fqdn')
    set(`${key}Ip`, h.ipAddress, path + ' .ipAddress')
  })

  // ── Appliances & VIPs ──
  const sddc = d.appliances.find(x => x.applianceName === 'sddc-manager-01')
  if (sddc && has(sddc.fqdn)) set('sddcHostname', String(sddc.fqdn).split('.')[0], 'appliances[sddc-manager-01].fqdn')
  d.vips && d.vips.forEach(v => {
    const m = VIPS[v.vipName]
    if (!m) { if (has(v.fqdn) || has(v.ipAddress)) skip(`vips[${v.vipName}]`, 'no equivalent VIP in P&P'); return }
    set(m[0], v.fqdn, `vips[${v.vipName}].fqdn`); set(m[1], v.ipAddress, `vips[${v.vipName}].ipAddress`)
  })
  d.appliances.forEach(x => {
    const m = APPLIANCES[x.applianceName]
    if (!m) { if (has(x.fqdn) || has(x.ipAddress)) skip(`appliances[${x.applianceName}]`, `${x.applianceType || 'appliance'} — no equivalent field in P&P`); return }
    // VIP wins over the VCF Automation appliance row when both are filled
    if (x.applianceName === 'vcf-automation-01' && d.vips && d.vips.some(v => v.vipName === 'VCF Automation VIP' && (has(v.fqdn) || has(v.ipAddress)))) return
    if (m[0]) set(m[0], x.fqdn, `appliances[${x.applianceName}].fqdn`)
    set(m[1], x.ipAddress, `appliances[${x.applianceName}].ipAddress`)
    if (x.applianceName === 'vcf-nets-platform-01') set('vcfNetOpsIp', x.ipAddress, `appliances[${x.applianceName}].ipAddress`)
  })

  // ── Workload domains ──
  if (wlds.length) {
    set('wldInclude', 'Include', 'workloadDomains[0]')
    setIfEmpty('wldName', String(wlds[0].domainName || '').toLowerCase(), 'workloadDomains[0].domainName', 'NP domain name used as Workload Domain Name')
    if (STORAGE[wlds[0].storageType]) set('wldStorageType', STORAGE[wlds[0].storageType], 'workloadDomains[0].storageType')
    if (wlds.length > 1) skip('workloadDomains[1..]', `${wlds.length - 1} additional workload domain(s) — P&P plans a single workload domain`)
  }

  report.skipped.push({ key:'—', sheet:'NP', cell:'(not in NP)', reason:(dns.length || ntp.length ? '' : 'DNS / NTP servers (NP < v1.31.0), ') + 'passwords, VDS / portgroups, BGP, witness DNS/NTP and vCenter inventory names are not part of a Network Planner export — fill them in P&P' })
  return report
}
