// Form schema + prerequisite reference data — extracted verbatim from index.html.
// Field-factory helpers and showWhen/optionsFn closures take the form object as an
// argument (never Alpine 'this'), so this module is environment-agnostic.
import { SUBNET_MASKS } from './data.js'

function makeNetFields(prefix, label, defVlan, defGw, defCidr, defMtu, hasPool) {
  const f = [
    { key:`${prefix}Vlan`,    label:`${label} VLAN ID`,      type:'number', sample:`${defVlan}`, notes:'VLAN ID for this network segment', required:true },
    { key:`${prefix}Gateway`, label:`${label} Gateway`,      type:'ip',     sample:defGw,  notes:'Default gateway IP', required:true },
    { key:`${prefix}Cidr`,    label:`${label} Subnet CIDR`,  type:'cidr',   sample:defCidr, notes:'Network CIDR notation (e.g. 10.0.0.0/24)', required:true },
    { key:`${prefix}Mtu`,     label:`${label} MTU`,          type:'number', sample:`${defMtu}`, notes:'MTU bytes' },
  ]
  if (hasPool) {
    f.push({ key:`${prefix}IpStart`, label:`${label} IP Range Start`, type:'ip', sample:'', notes:'First IP in the static pool' })
    f.push({ key:`${prefix}IpEnd`,   label:`${label} IP Range End`,   type:'ip', sample:'', notes:'Last IP in the static pool' })
  }
  return f
}

function withShowWhen(fields, fn) {
  return fields.map(f => ({ ...f, showWhen: fn }))
}

function makeUplinkFields(prefix, start, end) {
  const fields = []
  for (let i=start; i<=end; i++) {
    fields.push({ key:`${prefix}${i}Name`, label:`Uplink ${i} Name`, type:'text', sample:`uplink${i}`,
      showWhen: f => f.dvsProfile==='Custom Switch Configuration' && parseInt(f.dvsUplinkCount||'2',10) >= i })
  }
  return fields
}

function makeHostFields(n, prefix, ipBase, vlanBase) {
  const fields = []
  for (let i=1; i<=n; i++) {
    const pad = i<10?`0${i}`:i
    fields.push(
      { key:`${prefix}Host${i}Fqdn`, label:`Host ${i} FQDN`, type:'text', sample:`sfo-${prefix.replace('_','-')}-esxi${pad}.sfo.rainpole.io`, required: i<=4 },
      { key:`${prefix}Host${i}Ip`,   label:`Host ${i} IP`,   type:'ip',   sample:`${ipBase}.${10+i}`, required: i<=4 },
    )
  }
  return fields
}

function makeRackFields(rackNum) {
  const r = rackNum
  const vBase = 1300+r*10
  return {
    title: `Rack ${r+1} Network Configuration`,
    showWhen: f => (f.clusterType||'') === 'Multi-Rack L3',
    fields: [
      ...makeNetFields(`rack${r}EsxMgmt`, `Rack ${r+1} ESX Mgmt`, vBase+2, `10.13.${r}2.1`, `10.13.${r}2.0/24`, 1500, true),
      ...makeNetFields(`rack${r}VMotion`, `Rack ${r+1} vMotion`,  vBase+3, `10.13.${r}3.1`, `10.13.${r}3.0/24`, 9000, true),
      ...makeNetFields(`rack${r}VSan`,    `Rack ${r+1} vSAN`,     vBase+4, `10.13.${r}4.1`, `10.13.${r}4.0/24`, 9000, true),
      ...makeNetFields(`rack${r}Overlay`, `Rack ${r+1} Overlay`,  vBase+5, `10.13.${r}5.1`, `10.13.${r}5.0/24`, 9000, false),
    ]
  }
}

export const PREREQ_DATA = [
  {
    title: 'Server Hardware',
    rows: [
      { component:'CPU', requirement:'Minimum 2 sockets, 8+ cores/socket', notes:'Check VMware Compatibility Guide (HCL)' },
      { component:'RAM', requirement:'Minimum 512 GB per host recommended', notes:'4 hosts minimum for HA cluster' },
      { component:'Boot Storage', requirement:'2× M.2 or SSD (≥64 GB each) in RAID-1', notes:'Or single USB/SD — check VCF HCL' },
      { component:'vSAN-ESA Storage', requirement:'≥4 NVMe drives per host (≥1.6 TB each)', notes:'All drives must be HCL-approved' },
      { component:'vSAN-OSA Storage', requirement:'≥1 cache drive + ≥3 capacity drives per host', notes:'Check vSAN HCL for supported drives' },
      { component:'NIC', requirement:'2× 25 GbE minimum (10 GbE for lab)', notes:'RDMA (RoCE/iWARP) recommended for vSAN-ESA' },
    ]
  },
  {
    title: 'Network Infrastructure',
    rows: [
      { component:'Switching', requirement:'Physical switches with VLAN trunking', notes:'LACP / MLAG optional but recommended' },
      { component:'MTU', requirement:'9000 bytes (jumbo frames) for vSAN/overlay networks', notes:'End-to-end jumbo frames required' },
      { component:'Routing', requirement:'BGP or static routing for NSX overlay', notes:'L3 connectivity for multi-rack deployments' },
      { component:'DNS', requirement:'Forward + Reverse DNS entries for all components', notes:'DNS must resolve before deployment' },
      { component:'NTP', requirement:'NTP server reachable from all hosts', notes:'Time sync critical for certificates/auth' },
    ]
  },
  {
    title: 'Software & Licensing',
    rows: [
      { component:'VCF License', requirement:'VCF 9.1 perpetual or subscription license', notes:'Include activation code for SDDC Manager' },
      { component:'ESXi', requirement:'VMware ESXi 9.0 (bundled with VCF 9.1)', notes:'Downloaded via depot or offline bundle' },
      { component:'Depot Access', requirement:'Online: internet access from SDDC Manager host', notes:'Offline: local depot server required' },
      { component:'Active Directory', requirement:'AD/LDAP server reachable from management network', notes:'Required for identity provider integration' },
    ]
  },
  {
    title: 'Certificates & Security',
    rows: [
      { component:'CA', requirement:'Microsoft CA or OpenSSL CA (or VMware-generated self-signed)', notes:'Certificate SANs must match FQDNs' },
      { component:'Passwords', requirement:'Meet complexity: 8+ chars, upper/lower/digit/special', notes:'All appliance passwords stored in SDDC Manager' },
    ]
  },
  {
    title: 'Optional Infrastructure Services',
    rows: [
      { component:'vSAN Witness Appliance', requirement:'Required for vSAN stretched cluster or 2-node HA', notes:'Deploy on separate fault domain; OVA from Broadcom depot' },
      { component:'DHCP Server', requirement:'Optional — for NSX overlay segment auto-addressing', notes:'Scope must cover overlay T1 segment ranges' },
      { component:'SMTP Relay', requirement:'Optional — for SDDC Manager and VCF Operations alert email', notes:'Port 25 or 587 reachable from management network' },
      { component:'SFTP Server', requirement:'Optional — for SDDC Manager backup configuration', notes:'Credential and path configured post-deployment in SDDC Manager' },
    ]
  },
]

export const ALL_PAGES = [
  // ─── PLANNING ───
  {
    id:'planning', title:'VCF & VVF Planning', icon:'🗂️', group:'planning',
    subtitle:'Master configuration — drives all downstream sections',
    sections:[
      {
        title:'Deployment Selections',
        description:'These selections cascade to control which sections are visible throughout the workbook.',
        fields:[
          { key:'vcfVersion',      label:'VCF Version',         type:'select', options:['9.1.0.0'], sample:'9.1.0.0', required:true, notes:'VCF release version' },
          { key:'deploymentType',  label:'Product Type',        type:'select',
            options:['VMware Cloud Foundation','VMware vSphere Foundation'],
            sample:'VMware Cloud Foundation', required:true,
            notes:'VCF includes NSX, vSAN, Workload Domains. VVF is vSphere + vSAN only.' },
          { key:'deploymentMode',  label:'Deployment Mode',     type:'select',
            optionsFn: f => f.deploymentType==='VMware vSphere Foundation'
              ? ['New VVF Fleet','Additional vSphere Cluster']
              : ['New VCF Fleet','Additional VCF Instance','Workload Domain','Additional Cluster','Deferred Workload Domain'],
            sample:'New VCF Fleet', required:true,
            notes:'Select the type of deployment operation' },
          { key:'deploymentOperation', label:'Deployment Operation', type:'select',
            optionsFn: f => {
              if (f.deploymentMode==='New VCF Fleet')           return ['Deploy a new VCF fleet','Import existing environment']
              if (f.deploymentMode==='Additional VCF Instance') return ['Deploy additional VCF instance']
              if (f.deploymentMode==='Workload Domain')         return ['Deploy new workload domain','Deferred workload domain']
              if (f.deploymentMode==='Additional Cluster')      return ['Deploy additional cluster']
              if (f.deploymentMode==='New VVF Fleet')           return ['Deploy a new VVF fleet']
              if (f.deploymentMode==='Additional vSphere Cluster') return ['Deploy additional vSphere cluster']
              return ['Deploy a new VCF fleet']
            },
            sample:'Deploy a new VCF fleet', required:true,
            showWhen: f => !!f.deploymentMode,
            notes:'Specific deployment operation within the selected mode' },
          { key:'deploymentInstance', label:'Instance Name (prefix)', type:'text', sample:'m01', required:true, notes:'e.g. m01 for first instance' },
          { key:'primarySiteName', label:'Primary Site Name',   type:'text', sample:'sfo', required:true, notes:'Short site identifier, used in all FQDNs' },
          { key:'deploymentScale', label:'Deployment Scale', type:'select',
            optionsFn: f => {
              if (f.deploymentMode==='New VCF Fleet') return ['Standard (4+ hosts)','Consolidated (3 hosts — lab only)']
              if (f.deploymentMode==='New VVF Fleet') return ['Standard','Minimal (3 hosts)']
              return ['Standard']
            },
            sample:'Standard (4+ hosts)', showWhen:f=>!!f.deploymentMode, notes:'Determines minimum host count and component footprint' },
          { key:'deploymentRegion', label:'Region / Site Code', type:'text', sample:'sfo',
            showWhen:f=>!!f.deploymentScale, notes:'2-4 character region code used in all generated FQDNs (e.g. sfo, lax, fra)' },
        ]
      },
      {
        title:'Deployment Summary',
        fields:[
          { key:'_depTypeResult', label:'Product Type Selected', type:'readonly', calc:(f)=>f.deploymentType||'Not selected' },
          { key:'_depModeResult', label:'Mode Selected',         type:'readonly', calc:(f)=>f.deploymentMode||'Not selected' },
          { key:'_wldVisible',    label:'Workload Domain Steps', type:'readonly',
            calc:(f)=>f.deploymentType==='VMware Cloud Foundation'?'Included':'Excluded (VVF does not support WLDs)' },
          { key:'_nsxVisible',    label:'NSX Steps',             type:'readonly',
            calc:(f)=>f.deploymentType==='VMware Cloud Foundation'?'Included':'Excluded (VVF does not include NSX)' },
          { key:'_drVisible',     label:'DR / Recovery Steps',   type:'readonly',
            calc:(f)=>f.deploymentType==='VMware Cloud Foundation'?'Included':'Excluded' },
        ]
      }
    ]
  },

  // ─── PREREQUISITES ───
  { id:'prerequisites', title:'Prerequisite Checklist', icon:'✅', group:'planning',
    subtitle:'Hardware, network, and software requirements', sections:[] },

  // ─── SIZING ───
  { id:'sizing', title:'Management Domain Sizing', icon:'📐', group:'sizing',
    subtitle:'Standalone calculator — compute minimum host count and disk requirements', sections:[] },

  // ─── DEPLOY MANAGEMENT DOMAIN ───
  {
    id:'deploy-mgmt', title:'Deploy Management Domain', icon:'🏗️', group:'mgmt',
    subtitle:'Step-by-step deployment configuration for the management domain',
    sections:[
      {
        title:'VCF Installer Export Settings',
        description:'Used only by the "VCF Installer JSON" export (POST /v1/sddcs payload).',
        fields:[
          { key:'vcfInstanceName', label:'VCF Instance Name', type:'text', sample:'vcf001',
            notes:'Maps to vcfInstanceName in the VCF Installer spec' },
          { key:'sddcId',          label:'SDDC ID',           type:'text', sample:'md1',
            notes:'3-20 chars, alphanumeric/hyphen only. Required by VCF Installer.' },
          { key:'ceipEnabled',     label:'Enable CEIP',       type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'skipEsxThumbprintValidation', label:'Skip ESXi SSL Thumbprint Validation', type:'toggle', options:['Include','Exclude'], sample:'Include',
            notes:'When included, host credentials/SSL thumbprints are omitted from the export' },
        ]
      },
      {
        title:'Download Binaries',
        fields:[
          { key:'depotType',        label:'Depot Type',              type:'select', options:['Online','Offline'], sample:'Online', required:true, notes:'Online requires internet access from SDDC Manager. Offline requires a local depot server.' },
          { key:'offlineDepotHost', label:'Offline Depot Hostname',  type:'text',   sample:'depot.rainpole.io', showWhen:f=>f.depotType==='Offline', notes:'FQDN or IP of the local depot server' },
          { key:'offlineDepotPort', label:'Offline Depot Port',      type:'number', sample:'443', showWhen:f=>f.depotType==='Offline' },
          { key:'downloadSvcId',    label:'Download Service ID',     type:'text',   sample:'', notes:'Service account ID for depot access' },
          { key:'activationCode',   label:'VCF Activation Code',     type:'text',   sample:'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', required:true, notes:'Required to activate SDDC Manager license' },
        ]
      },
      {
        title:'Proxy Settings (Optional)',
        fields:[
          { key:'proxyEnabled',  label:'Use Proxy',          type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'proxyProtocol', label:'Proxy Protocol',     type:'select', options:['HTTP','HTTPS','SOCKS5'], sample:'HTTP', showWhen:f=>f.proxyEnabled==='Include' },
          { key:'proxyHost',     label:'Proxy Hostname/IP',  type:'text',   sample:'proxy.rainpole.io', showWhen:f=>f.proxyEnabled==='Include' },
          { key:'proxyPort',    label:'Proxy Port',         type:'number', sample:'3128', showWhen:f=>f.proxyEnabled==='Include' },
          { key:'proxyUser',    label:'Proxy Username',     type:'text',   sample:'', showWhen:f=>f.proxyEnabled==='Include' },
          { key:'proxyPass',    label:'Proxy Password',     type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.proxyEnabled==='Include' },
        ]
      },
      {
        title:'Cluster & Scale Options',
        fields:[
          { key:'mgmtClusterType', label:'Management Cluster Type', type:'select', options:['High Availability (Three-Node)','Simple'], sample:'High Availability (Three-Node)', required:true, notes:'HA requires minimum 4 hosts. Simple requires 1 host.' },
          { key:'evcMode',         label:'EVC Mode',                type:'select',
            options:['Disabled','Intel Cascadelake','Intel Skylake','Intel Broadwell','Intel Haswell','Intel Ivy Bridge','Intel Sandy Bridge','AMD EPYC Rome','AMD EPYC Milan','AMD EPYC Genoa'],
            sample:'Disabled', notes:'Enhanced vMotion Compatibility mode — set to lowest common CPU microarch in cluster' },
          { key:'nsxDeployType',   label:'NSX Manager Deployment',  type:'select',
            options:['Create new NSX Manager Instance','Join existing NSX Manager Instance'],
            sample:'Create new NSX Manager Instance', required:true,
            showWhen:f=>f.deploymentType==='VMware Cloud Foundation' },
          { key:'nsxMgrCount',     label:'NSX Manager Cluster',     type:'select',
            options:['Single NSX Manager Appliance','NSX Management Cluster (3 nodes)'],
            sample:'NSX Management Cluster (3 nodes)',
            showWhen:f=>f.deploymentType==='VMware Cloud Foundation' },
        ]
      },
      {
        title:'Network Options',
        fields:[
          { key:'ipScheme',     label:'IP Addressing Scheme', type:'select', options:['IPv4 Only','IPv6 Only','IPv4 & IPv6'], sample:'IPv4 Only', required:true },
          { key:'nicsPerHost',   label:'NICs per Host',        type:'select', options:['2','4'], sample:'2', required:true, notes:'2-NIC: one VDS with all traffic. 4-NIC: dedicated VDS per workload.' },
          { key:'transitGwType', label:'Transit Gateway Type', type:'select', options:['Distributed connectivity','Centralized connectivity'], sample:'Distributed connectivity' },
        ]
      },
      {
        title:'Storage Options',
        fields:[
          { key:'principalStorage', label:'Principal Storage Type', type:'select',
            options:['vSAN-ESA','vSAN-OSA','VMFS on Fibre Channel (FC)','NFSv3'],
            sample:'vSAN-ESA', required:true },
          { key:'vsanFtt',        label:'vSAN FTT (Failure Tolerance)', type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-planning-and-deployment/designing-and-sizing-a-virtual-san-cluster/design-considerations-for-a-virtual-san-cluster.html', docLabel:'vSAN Cluster Design Considerations (TechDocs)', options:['1','2'], sample:'1',
            showWhen:f=>f.principalStorage&&f.principalStorage.startsWith('vSAN') },
          { key:'vsanEncryptDit', label:'Data-in-Transit Encryption',   type:'select', options:['Selected','Unselected'], sample:'Unselected',
            showWhen:f=>f.principalStorage&&f.principalStorage.startsWith('vSAN') },
          { key:'vsanDedup',      label:'Dedup & Compression',          type:'select', options:['Selected','Unselected'], sample:'Unselected',
            showWhen:f=>f.principalStorage==='vSAN-OSA', notes:'Not available on vSAN-ESA' },
          { key:'nfsServer',      label:'NFS Server IP/FQDN',           type:'text',  sample:'nfs.sfo.rainpole.io',
            showWhen:f=>f.principalStorage==='NFSv3', required:true },
          { key:'nfsPath',        label:'NFS Mount Path',               type:'text',  sample:'/vcf/mgmt01',
            showWhen:f=>f.principalStorage==='NFSv3' },
          { key:'nfsVmknicBinding', label:'NFS vmknic Binding',         type:'select', options:['Enabled','Disabled'], sample:'Disabled',
            showWhen:f=>f.principalStorage==='NFSv3', notes:'NFS TCP port binding on vmknic' },
          { key:'fcDatastore',    label:'FC Datastore Name',            type:'text',  sample:'sfo-m01-cl01-ds-fc01',
            showWhen:f=>f.principalStorage&&f.principalStorage.includes('FC') },
        ]
      },
      {
        title:'Networks — NFS',
        showWhen: f => f.principalStorage==='NFSv3',
        fields:[
          ...makeNetFields('nfs', 'NFS', 1115, '10.11.15.1', '10.11.15.0/24', 9000, true),
        ]
      },
      {
        title:'General Information',
        fields:[
          { key:'domainName',      label:'DNS Domain Name',          type:'text', sample:'rainpole.io', required:true, notes:'Root DNS domain for the environment' },
          { key:'subDomainName',   label:'Child Domain Name',        type:'text', sample:'sfo.rainpole.io', required:true, notes:'Site-specific subdomain' },
          { key:'vcfSddcFqdn',     label:'SDDC Manager FQDN',        type:'text', sample:'sfo-m01-sddc01.sfo.rainpole.io', required:true },
          { key:'vcfSddcIp',       label:'SDDC Manager IP',          type:'ip',   sample:'10.11.10.4', required:true },
          { key:'ntpServer1',      label:'NTP Server 1',             type:'text', sample:'ntp.sfo.rainpole.io', required:true },
          { key:'ntpServer2',      label:'NTP Server 2 (optional)',  type:'text', sample:'' },
          { key:'dnsServer1',      label:'DNS Server 1',             type:'ip',   sample:'10.11.0.2', required:true },
          { key:'dnsServer2',      label:'DNS Server 2 (optional)',  type:'ip',   sample:'10.11.0.3' },
        ]
      },
      {
        title:'Hosts (Management Cluster)',
        description:'Minimum 4 hosts for High Availability cluster. Enter FQDN and management IP for each ESXi host.',
        fields: makeHostFields(16,'m01','10.11.10','1110'),
      },
      {
        title:'Networks — Management',
        fields:[
          // No IP range fields here — the workbook asks the management networks for VLAN / MTU /
          // gateway CIDR only (host IPs are per-host, appliance IPs are discrete fields).
          ...makeNetFields('esxMgmt',   'ESX Management',    1110, '10.11.10.1', '10.11.10.0/24', 1500, false),
          ...makeNetFields('vmMgmt',    'VM Management',     1111, '10.11.11.1', '10.11.11.0/24', 1500, false),
          { key:'vcfMgmtInclude', label:'Dedicated VCF Management Network', type:'toggle', options:['Include','Exclude'], sample:'Exclude',
            notes:'Optional — the workbook masks these inputs out unless you use a separate and dedicated network for VCF Management components. Excluded: the management components land on the VM Management network.' },
          ...makeNetFields('vcfMgmt',   'VCF Management',    1112, '10.11.12.1', '10.11.12.0/24', 1500, false).map(fld => ({ ...fld, showWhen:f=>f.vcfMgmtInclude==='Include' })),
        ]
      },
      {
        title:'Networks — vMotion, vSAN & Overlay',
        fields:[
          ...makeNetFields('vmotion',   'vMotion',   1113, '10.11.13.1', '10.11.13.0/24', 9000, true),
          ...withShowWhen(makeNetFields('vsan1', 'vSAN', 1114, '10.11.14.1', '10.11.14.0/24', 9000, true),
            f=>!f.principalStorage||f.principalStorage.startsWith('vSAN')),
          ...makeNetFields('overlay',   'Overlay (TEP)', 1116, '10.11.16.1', '10.11.16.0/24', 9000, true),
        ]
      },
      {
        title:'vCenter Server',
        fields:[
          { key:'vcMgmtFqdn',    label:'vCenter FQDN',              type:'text', sample:'sfo-m01-vc01.sfo.rainpole.io', required:true },
          { key:'vcMgmtIp',      label:'vCenter IP',                type:'ip',   sample:'10.11.10.3', required:true },
          { key:'vcMgmtSize',    label:'vCenter Appliance Size',    type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/vmware-cloud-foundation-concepts/vcf-fleet-sizing-models(1).html', docLabel:'VCF Fleet Sizing Models (TechDocs)', options:['Tiny','Small','Medium','Large','XLarge'], sample:'Medium', required:true },
          { key:'vcSsoDomain',   label:'SSO Domain',                type:'text', sample:'vsphere.local', required:true },
          { key:'vcSsoAdminPw',  label:'SSO Admin Password',        type:'password', sample:'AUTO-GENERATED', required:true, notes:'min 8 chars, complexity required' },
          { key:'vcRootPw',      label:'Root Password',             type:'password', sample:'AUTO-GENERATED', required:true },
          { key:'vcDatacenter',  label:'Datacenter Name',           type:'text', sample:'sfo-m01-dc01', required:true },
          { key:'vcCluster',     label:'Cluster Name',              type:'text', sample:'sfo-m01-cl01', required:true },
          { key:'vcDatastore',   label:'vSAN Datastore Name',       type:'text', sample:'sfo-m01-cl01-ds-vsan01', required:true,
            showWhen:f=>!f.principalStorage||f.principalStorage.startsWith('vSAN') },
        ]
      },
      {
        title:'SDDC Manager',
        fields:[
          { key:'sddcHostname',  label:'SDDC Manager Hostname',    type:'text', sample:'sfo-m01-sddc01', required:true },
          { key:'sddcAdminPw',   label:'Admin Password',           type:'password', sample:'AUTO-GENERATED', required:true },
          { key:'sddcRootPw',    label:'Root Password',            type:'password', sample:'AUTO-GENERATED', required:true },
          { key:'esxiRootPw',    label:'ESXi Root Password (all hosts)', type:'password', sample:'AUTO-GENERATED', required:true, notes:'All management cluster hosts must share the same root password' },
          { key:'sddcLocation',  label:'SDDC Manager Location', type:'select', options:['Deployed on one of the management domain hosts','External deployment'], sample:'Deployed on one of the management domain hosts' },
        ]
      },
      {
        title:'VCF Operations',
        description:'The VCF Installer deploys VCF Operations fleet management as part of management-domain bring-up (workbook: Deploy Management Domain → VCF Management services) — capture the node FQDNs and IPs here.',
        fields:[
          { key:'vcfOpsHaMode',      label:'VCF Operations Deployment Model', type:'select', options:['Single Node','HA Cluster'], sample:'HA Cluster',
            notes:'Workbook "Deployment model": Simple (single node) or High Availability (Three-Node). Applies to newly deployed VCF Operations appliances.' },
          { key:'vcfOpsPrimaryFqdn', label:'VCF Operations Primary Node FQDN', type:'text', sample:'flt-ops01a.rainpole.io', required:true },
          { key:'vcfOpsPrimaryIp',   label:'VCF Operations Primary Node IP',   type:'ip',   sample:'10.11.10.52' },
          { key:'vcfOpsReplicaFqdn', label:'VCF Operations Replica Node FQDN', type:'text', sample:'flt-ops01b.rainpole.io', showWhen:f=>f.vcfOpsHaMode==='HA Cluster' },
          { key:'vcfOpsReplicaIp',   label:'VCF Operations Replica Node IP',   type:'ip',   sample:'10.11.10.53', showWhen:f=>f.vcfOpsHaMode==='HA Cluster' },
          { key:'vcfOpsDataFqdn',    label:'VCF Operations Data Node FQDN',    type:'text', sample:'flt-ops01c.rainpole.io', showWhen:f=>f.vcfOpsHaMode==='HA Cluster' },
          { key:'vcfOpsDataIp',      label:'VCF Operations Data Node IP',      type:'ip',   sample:'10.11.10.54', showWhen:f=>f.vcfOpsHaMode==='HA Cluster' },
          { key:'vcfOpsLbFqdn',      label:'VCF Operations Load Balancer FQDN', type:'text', sample:'flt-ops01.rainpole.io', showWhen:f=>f.vcfOpsHaMode==='HA Cluster',
            notes:'Optional — VCF Operations has no built-in cluster/floating IP (without a load balancer you reach the cluster via the node FQDNs); a load-balancer VIP must come from an external load balancer (never provided by VCF).' },
          { key:'vcfOpsLbIp',        label:'VCF Operations Load Balancer IP',  type:'ip',   sample:'10.11.10.21', showWhen:f=>f.vcfOpsHaMode==='HA Cluster' },
          { key:'vcfOpsSize',        label:'VCF Operations Size',              type:'select', options:['Small','Medium','Large'], sample:'Small' },
          { key:'vcfOpsAdminPw',     label:'Admin Password',                   type:'password', sample:'AUTO-GENERATED' },
        ]
      },
      {
        title:'NSX Manager Cluster',
        description:'NSX Manager is deployed as a 3-node cluster (or single node for lab).',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'nsxMgr1Fqdn',   label:'NSX Manager 1 FQDN',      type:'text', sample:'sfo-m01-nsx01a.sfo.rainpole.io', required:true },
          { key:'nsxMgr1Ip',     label:'NSX Manager 1 IP',         type:'ip',   sample:'10.11.10.71', required:true },
          { key:'nsxMgr2Fqdn',   label:'NSX Manager 2 FQDN',      type:'text', sample:'sfo-m01-nsx01b.sfo.rainpole.io' },
          { key:'nsxMgr2Ip',     label:'NSX Manager 2 IP',         type:'ip',   sample:'10.11.10.72' },
          { key:'nsxMgr3Fqdn',   label:'NSX Manager 3 FQDN',      type:'text', sample:'sfo-m01-nsx01c.sfo.rainpole.io' },
          { key:'nsxMgr3Ip',     label:'NSX Manager 3 IP',         type:'ip',   sample:'10.11.10.73' },
          { key:'nsxVipFqdn',    label:'NSX Cluster VIP FQDN',     type:'text', sample:'sfo-m01-nsx01.sfo.rainpole.io', required:true },
          { key:'nsxVipIp',      label:'NSX Cluster VIP IP',       type:'ip',   sample:'10.11.10.74', required:true },
          { key:'nsxAdminPw',    label:'NSX Admin Password',       type:'password', sample:'AUTO-GENERATED', required:true },
          { key:'nsxAuditPw',    label:'NSX Audit Password',       type:'password', sample:'AUTO-GENERATED' },
          { key:'nsxMgrSize',    label:'NSX Manager Appliance Size', type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/9-0/nsx-manager-and-host-transport-node-system-requirements.html', docLabel:'NSX Manager System Requirements (TechDocs)', options:['Small','Medium','Large','XLarge'], sample:'Small', required:true },
        ]
      },
      {
        title:'NSX Edge Nodes (Optional)',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'nsxEdgeInclude', label:'Deploy NSX Edge Nodes',    type:'toggle', options:['Include','Exclude'], sample:'Include' },
          { key:'nsxEdge1Fqdn',   label:'NSX Edge 1 FQDN',         type:'text', sample:'sfo-m01-nsx01-edge01.sfo.rainpole.io', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdge1Ip',     label:'NSX Edge 1 Mgmt IP',      type:'ip',   sample:'10.11.10.81', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdge2Fqdn',   label:'NSX Edge 2 FQDN',         type:'text', sample:'sfo-m01-nsx01-edge02.sfo.rainpole.io', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdge2Ip',     label:'NSX Edge 2 Mgmt IP',      type:'ip',   sample:'10.11.10.82', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdgeSize',      label:'NSX Edge Appliance Size',  type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/installing-nsx-edge/edge-vm-system-requirements.html', docLabel:'NSX Edge VM System Requirements (TechDocs)', options:['Excluded','NSX Edge Small','NSX Edge Medium','NSX Edge Large','NSX Edge XLarge','VNA Small','VNA Medium','VNA Large','VNA XLarge'], sample:'NSX Edge Large', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edgeHaMode',     label:'Edge HA Mode',             type:'select', options:['Active-Active','Active-Standby'], sample:'Active-Active', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edgeTepVlan',    label:'TEP VLAN ID',              type:'number', sample:'1116', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edgeTepIpStart', label:'TEP IP Pool Start',        type:'ip',     sample:'10.11.16.100', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edgeTepIpEnd',   label:'TEP IP Pool End',          type:'ip',     sample:'10.11.16.200', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edge1UplinkVlan1', label:'Edge 1 Uplink VLAN 1',  type:'number', sample:'2711', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edge1UplinkVlan2', label:'Edge 1 Uplink VLAN 2',  type:'number', sample:'2712', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edge2UplinkVlan1', label:'Edge 2 Uplink VLAN 1',  type:'number', sample:'2711', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'edge2UplinkVlan2', label:'Edge 2 Uplink VLAN 2',  type:'number', sample:'2712', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdgeUplink1Vlan', label:'Edge Uplink 1 VLAN',  type:'number', sample:'2711', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdgeUplink2Vlan', label:'Edge Uplink 2 VLAN',  type:'number', sample:'2712', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdgeBgpAsn',  label:'Edge BGP ASN',            type:'number', sample:'65101', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
          { key:'nsxEdgePw',      label:'Edge Root Password',      type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.nsxEdgeInclude!=='Exclude' },
        ]
      },
      {
        title:'Distributed Switch Profile',
        fields:[
          { key:'dvsProfile',     label:'DVS Profile',              type:'select',
            optionsFn: f => f.deploymentType==='VMware Cloud Foundation'
              ? ['Default','Storage Traffic Separation','NSX Traffic Separation','Storage Traffic and NSX Traffic Separation','Custom Switch Configuration']
              : ['Default','Storage Traffic Separation','Custom Switch Configuration'],
            sample:'Default', required:true, notes:'Determines which VDS switches are deployed' },
          { key:'dvsName',        label:'Primary VDS Name',         type:'text',   sample:'sfo-m01-cl01-dvs01', required:true },
          { key:'dvsVersion',     label:'VDS Version',              type:'select', options:['9.0.0','8.0.0','7.0.3'], sample:'9.0.0' },
          { key:'dvsUplinkPolicy',label:'Teaming Policy',           type:'select',
            options:['Route based on IP hash','Route based on source MAC hash','Route based on source port ID','Use explicit failover order','Route Based on Physical NIC Load'],
            sample:'Route based on IP hash' },
          { key:'dvsLacpEnabled', label:'LACP Enabled',             type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'dvsLacpMode',    label:'LACP Mode',                type:'select', options:['Active','Passive'], sample:'Active', showWhen:f=>f.dvsLacpEnabled==='Include' },
          { key:'dvsLacpTimeout', label:'LACP Timeout',             type:'select', options:['Slow','Fast'], sample:'Fast', showWhen:f=>f.dvsLacpEnabled==='Include' },
          { key:'dvsUplinkCount', label:'Number of Uplinks (NICs)', type:'select', options:['2','3','4','5','6','7','8','9','10'], sample:'2',
            showWhen:f=>f.dvsProfile==='Custom Switch Configuration', notes:'Number of physical NIC uplinks assigned to the primary VDS' },
          { key:'dvsUplink1Name', label:'Uplink 1 Name',            type:'text',   sample:'uplink1' },
          { key:'dvsUplink2Name', label:'Uplink 2 Name',            type:'text',   sample:'uplink2' },
          ...makeUplinkFields('dvsUplink', 3, 10),
        ]
      },
      {
        title:'Secondary VDS (Storage Traffic)',
        showWhen: f => f.dvsProfile && f.dvsProfile !== 'Default',
        fields:[
          { key:'dvs2Name',        label:'Secondary VDS Name',      type:'text',   sample:'sfo-m01-cl01-dvs02', required:true },
          { key:'dvs2Uplink1Name', label:'Uplink 1 Name',           type:'text',   sample:'uplink1' },
          { key:'dvs2Uplink2Name', label:'Uplink 2 Name',           type:'text',   sample:'uplink2' },
        ]
      },
      {
        title:'Tertiary VDS (NSX Traffic)',
        showWhen: f => f.dvsProfile === 'Storage Traffic and NSX Traffic Separation',
        fields:[
          { key:'dvs3Name',        label:'Tertiary VDS Name',       type:'text',   sample:'sfo-m01-cl01-dvs03', required:true },
          { key:'dvs3Uplink1Name', label:'Uplink 1 Name',           type:'text',   sample:'uplink1' },
          { key:'dvs3Uplink2Name', label:'Uplink 2 Name',           type:'text',   sample:'uplink2' },
        ]
      },
      {
        title:'Appliance Sizing (API-only values)',
        amber: true,
        description:'These values are used when deploying via API/PowerShell. UI deployments auto-select sizing.',
        fields:[
          { key:'apiVcenterSize', label:'vCenter Size (API)',       type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/vmware-cloud-foundation-concepts/vcf-fleet-sizing-models(1).html', docLabel:'VCF Fleet Sizing Models (TechDocs)', options:['Tiny','Small','Medium','Large','XLarge'], sample:'Medium' },
          { key:'apiNsxSize',     label:'NSX Manager Size (API)',   type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/9-0/nsx-manager-and-host-transport-node-system-requirements.html', docLabel:'NSX Manager System Requirements (TechDocs)', options:['Small','Medium','Large','XLarge'], sample:'Small' },
          { key:'apiNsxOpMode',   label:'NSX Operation Mode',       type:'select', options:['Standard','Enhanced Datapath Standard','Enhanced Datapath Dedicated'], sample:'Standard' },
        ]
      },
      {
        title:'Cloud Proxy (VCF Operations)', amber:true,
        fields:[
          { key:'cloudProxyInclude', label:'Deploy Cloud Proxy',        type:'toggle',   options:['Include','Exclude'], sample:'Exclude' },
          { key:'cloudProxyFqdn',    label:'Cloud Proxy FQDN',          type:'text',     sample:'sfo-m01-cpxy01.sfo.rainpole.io', showWhen:f=>f.cloudProxyInclude==='Include' },
          { key:'cloudProxyIp',      label:'Cloud Proxy IP',            type:'ip',       sample:'10.11.10.91', showWhen:f=>f.cloudProxyInclude==='Include' },
          { key:'cloudProxyPw',      label:'Cloud Proxy Root Password', type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.cloudProxyInclude==='Include' },
        ]
      },
    ]
  },

  // ─── CONFIGURE MANAGEMENT DOMAIN ───
  {
    id:'configure-mgmt', title:'Configure Management Domain', icon:'⚙️', group:'mgmt',
    subtitle:'Post-deployment configuration tasks',
    sections:[
      {
        title:'SFTP Backup Configuration',
        fields:[
          { key:'sftpBackupInclude', label:'Configure SFTP Backups', type:'toggle', options:['Include','Exclude'], sample:'Include' },
          { key:'sftpHost',          label:'SFTP Server FQDN/IP',    type:'text',   sample:'sftp.sfo.rainpole.io', showWhen:f=>f.sftpBackupInclude!=='Exclude' },
          { key:'sftpPort',          label:'SFTP Port',              type:'number', sample:'22', showWhen:f=>f.sftpBackupInclude!=='Exclude' },
          { key:'sftpUser',          label:'SFTP Username',          type:'text',   sample:'vcf-backup', showWhen:f=>f.sftpBackupInclude!=='Exclude' },
          { key:'sftpPass',          label:'SFTP Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.sftpBackupInclude!=='Exclude' },
          { key:'sftpPath',          label:'SFTP Backup Path',       type:'text',     sample:'/vcf/backups', showWhen:f=>f.sftpBackupInclude!=='Exclude' },
          { key:'sftpFingerprint',   label:'SFTP Host Fingerprint',  type:'text',     sample:'', showWhen:f=>f.sftpBackupInclude==='Include' },
          { key:'sftpPassphrase',    label:'SFTP Passphrase',        type:'password', sample:'AUTO-GENERATED', notes:'Min 8 chars, 2 upper, 2 lower, 2 digits', showWhen:f=>f.sftpBackupInclude==='Include' },
        ]
      },
      {
        title:'Certificate Authority',
        fields:[
          { key:'caType',        label:'Certificate Authority',     type:'select', options:['Exclude','Microsoft CA','OpenSSL CA'], sample:'Microsoft CA' },
          { key:'caFqdn',        label:'CA Server FQDN',            type:'text',   sample:'rpl-dc01.rainpole.io', showWhen:f=>f.caType&&f.caType!=='Exclude' },
          { key:'caAdminUser',   label:'CA Admin Username',         type:'text',   sample:'svc-vcf-ca@rainpole.io', showWhen:f=>f.caType&&f.caType!=='Exclude' },
          { key:'caAdminPass',   label:'CA Admin Password',         type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.caType&&f.caType!=='Exclude' },
          { key:'caTemplate',    label:'Certificate Template',      type:'text',   sample:'VMwareWebServer', showWhen:f=>f.caType==='Microsoft CA' },
          { key:'certKeySize',   label:'Key Size',                  type:'select', options:['2048','3072','4096'], sample:'2048', showWhen:f=>f.caType&&f.caType!=='Exclude' },
          { key:'caOrg',         label:'Organization (O)',          type:'text',   sample:'Rainpole', showWhen:f=>f.caType==='OpenSSL CA' },
          { key:'caOrgUnit',     label:'Org Unit (OU)',             type:'text',   sample:'IT', showWhen:f=>f.caType==='OpenSSL CA' },
          { key:'caCountry',     label:'Country (2-char)',          type:'text',   sample:'US', showWhen:f=>f.caType==='OpenSSL CA' },
          { key:'caState',       label:'State / Province',         type:'text',   sample:'California', showWhen:f=>f.caType==='OpenSSL CA' },
          { key:'caLocality',    label:'Locality / City',          type:'text',   sample:'San Francisco', showWhen:f=>f.caType==='OpenSSL CA' },
          { key:'caKeySize',     label:'CA Key Size',              type:'select', options:['2048','4096'], sample:'4096', showWhen:f=>f.caType==='OpenSSL CA' },
        ]
      },
      {
        title:'NSX Network Connectivity',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'nsxConnectivity', label:'NSX Connectivity Type',   type:'select', options:['Exclude','Centralized Connectivity','Distributed Connectivity'], sample:'Centralized Connectivity' },
          { key:'nsxRoutingProtocol', label:'Routing Protocol',     type:'select', options:['BGP','STATIC'], sample:'BGP', showWhen:f=>f.nsxConnectivity&&f.nsxConnectivity!=='Exclude' },
          { key:'nsxT0Name',      label:'Tier-0 Gateway Name',      type:'text',   sample:'sfo-m01-ec01-t0-gw01', showWhen:f=>f.nsxConnectivity&&f.nsxConnectivity!=='Exclude' },
          { key:'nsxT0Asn',       label:'Tier-0 BGP ASN',           type:'number', sample:'65001', showWhen:f=>f.nsxRoutingProtocol==='BGP' },
          { key:'nsxUpstreamAsn', label:'Upstream BGP ASN',         type:'number', sample:'65000', showWhen:f=>f.nsxRoutingProtocol==='BGP' },
          { key:'nsxUpstreamIp1', label:'Upstream Peer IP 1',       type:'ip',     sample:'10.11.17.1', showWhen:f=>f.nsxRoutingProtocol==='BGP' },
          { key:'nsxUpstreamIp2', label:'Upstream Peer IP 2',       type:'ip',     sample:'10.11.17.2', showWhen:f=>f.nsxRoutingProtocol==='BGP' },
          { key:'nsxExtIpBlock',  label:'External IP Block CIDR',   type:'cidr',   sample:'192.168.11.0/24', showWhen:f=>f.nsxConnectivity&&f.nsxConnectivity!=='Exclude' },
        ]
      },
      {
        title:'NSX Federation (Multi-Site)',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'nsxFedRole',    label:'NSX Federation Role',       type:'select',
            options:['Exclude','Active Global Manager','Standby Global Manager','Connect Instance'],
            sample:'Exclude' },
          { key:'nsxGmVipFqdn',  label:'Global Manager VIP FQDN',   type:'text',     sample:'sfo-m01-gm01.rainpole.io', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmIp',       label:'Global Manager VIP IP',     type:'ip',       sample:'10.11.10.90', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode1Fqdn',label:'GM Node 1 FQDN',            type:'text',     sample:'sfo-m01-gm01a.rainpole.io', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode1Ip',  label:'GM Node 1 IP',              type:'ip',       sample:'10.11.10.91', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode2Fqdn',label:'GM Node 2 FQDN',            type:'text',     sample:'sfo-m01-gm01b.rainpole.io', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode2Ip',  label:'GM Node 2 IP',              type:'ip',       sample:'10.11.10.92', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode3Fqdn',label:'GM Node 3 FQDN',            type:'text',     sample:'sfo-m01-gm01c.rainpole.io', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmNode3Ip',  label:'GM Node 3 IP',              type:'ip',       sample:'10.11.10.93', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmAdminPw',  label:'GM Admin Password',         type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmRootPw',   label:'GM Root Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
          { key:'nsxGmAuditPw',  label:'GM Audit Password',         type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.nsxFedRole&&f.nsxFedRole!=='Exclude' },
        ]
      },
      {
        title:'vSphere Supervisor (Kubernetes)',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'supervisorInclude', label:'Enable vSphere Supervisor', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'supervisorCluster', label:'Supervisor Cluster',         type:'text', sample:'sfo-m01-cl01', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorStoragePolicy', label:'Storage Policy',       type:'text', sample:'sfo-m01-cl01-vsan-policy', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorContentLib',    label:'Content Library',      type:'text', sample:'sfo-m01-cl01-lib01', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorCidr',          label:'Ingress CIDR',         type:'cidr', sample:'192.168.30.0/24', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorEgressCidr',         label:'Egress CIDR',                type:'cidr',   sample:'192.168.31.0/24', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorName',               label:'Supervisor Name',             type:'text',   sample:'sfo-m01-sup01', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorHaEnabled',          label:'Supervisor HA',               type:'toggle', options:['Include','Exclude'], sample:'Include', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorControlPlaneSize',   label:'Control Plane Size',          type:'select', options:['Tiny','Small','Medium','Large','XLarge'], sample:'Small', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorMgmtNetworkRange',   label:'Management Network IP Range', type:'text',   sample:'10.11.10.150-10.11.10.160', showWhen:f=>f.supervisorInclude==='Include' },
          { key:'supervisorServiceCidr',        label:'Service CIDR',                type:'cidr',   sample:'10.96.0.0/24', showWhen:f=>f.supervisorInclude==='Include' },
        ]
      },
      {
        title:'AVI Load Balancer (NSX ALB)',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'aviInclude',    label:'Deploy AVI Load Balancer',   type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'aviCtrl1Fqdn',  label:'AVI Controller 1 FQDN',     type:'text', sample:'sfo-m01-avi01a.sfo.rainpole.io', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviCtrl1Ip',    label:'AVI Controller 1 IP',       type:'ip',   sample:'10.11.10.68', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviClusterIp',    label:'AVI Cluster IP',              type:'ip',     sample:'10.11.10.70', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviClusterFqdn',  label:'AVI Cluster FQDN',            type:'text',   sample:'sfo-m01-avi01.sfo.rainpole.io', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviCtrl2Fqdn',    label:'AVI Controller 2 FQDN',      type:'text',   sample:'sfo-m01-avi01b.sfo.rainpole.io', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviCtrl2Ip',      label:'AVI Controller 2 IP',        type:'ip',     sample:'10.11.10.69', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviCtrl3Fqdn',    label:'AVI Controller 3 FQDN',      type:'text',   sample:'sfo-m01-avi01c.sfo.rainpole.io', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviCtrl3Ip',      label:'AVI Controller 3 IP',        type:'ip',     sample:'10.11.10.71', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviAdminPass',    label:'AVI Admin Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviVersion',      label:'AVI Version',                 type:'text',   sample:'31.1.1', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviFormFactor',   label:'AVI Form Factor',             type:'select', options:['Edge Cluster Medium','Large'], sample:'Edge Cluster Medium', showWhen:f=>f.aviInclude==='Include' },
          { key:'aviSize',         label:'AVI Controller Size',         type:'select', options:['Small','Large','Extra-Large'], sample:'Small', showWhen:f=>f.aviInclude==='Include' },
        ]
      },
      {
        title:'vSAN Stretched Cluster (Optional)',
        description:'Stretching is performed post-bring-up (SDDC Manager API), but the workbook plans it up front: the AZ2 host networks and per-host IPs, an AZ2 network pool (vMotion / vSAN, plus NFS if used), the AZ2 host overlay VLAN, and the vSAN witness at a third site.',
        fields:[
          { key:'vsanStretchInclude', label:'Configure Stretched Cluster', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'secondaryAzName',    label:'Secondary AZ Name',           type:'text', sample:'lax', showWhen:f=>f.vsanStretchInclude==='Include' },
          // AZ2 networks — workbook: "vSAN Stretched Cluster → Initial Host Configuration" + "Create Network Pool"
          ...makeNetFields('az2EsxMgmt', 'AZ2 ESX Management', 1211, '10.12.11.1', '10.12.11.0/24', 1500, false).map(fld => ({ ...fld, showWhen:f=>f.vsanStretchInclude==='Include' })),
          ...makeNetFields('az2Vmotion', 'AZ2 vMotion',        1212, '10.12.12.1', '10.12.12.0/24', 9000, true).map(fld => ({ ...fld, showWhen:f=>f.vsanStretchInclude==='Include' })),
          ...makeNetFields('az2Vsan',    'AZ2 vSAN',           1213, '10.12.13.1', '10.12.13.0/24', 9000, true).map(fld => ({ ...fld, showWhen:f=>f.vsanStretchInclude==='Include' })),
          { key:'az2OverlayVlan',     label:'AZ2 Host Overlay VLAN',       type:'number', sample:'1414', required:true, showWhen:f=>f.vsanStretchInclude==='Include', notes:'Per-AZ host TEP VLAN for the stretched cluster' },
          // AZ2 hosts — workbook: "Commission Hosts" (FQDNs) + per-host management IPs
          ...makeHostFields(16,'az2','10.12.11','1211').map(fld => ({ ...fld, label:`AZ2 ${fld.label}`, showWhen:f=>f.vsanStretchInclude==='Include' })),
          // vSAN witness at the third site — workbook: "Deploy and Configure vSAN Witness"
          { key:'vsanWitnessHost',    label:'Witness Host FQDN',           type:'text', sample:'sfo-m01-witness01.rainpole.io', required:true, showWhen:f=>f.vsanStretchInclude==='Include' },
          { key:'vsanWitnessIp',      label:'Witness Host Management IP',  type:'ip',   sample:'192.168.10.1', required:true, showWhen:f=>f.vsanStretchInclude==='Include' },
          { key:'vsanWitnessVcFqdn',  label:'Witness Hosting vCenter FQDN', type:'text', sample:'lax-m01-vc01.lax.rainpole.io', required:true, showWhen:f=>f.vsanStretchInclude==='Include', notes:'vCenter Server outside AZ1 and AZ2 that hosts the vSAN witness' },
          { key:'vsanWitnessDns1',    label:'Witness DNS Server #1',       type:'ip',   sample:'10.21.10.4', required:true, showWhen:f=>f.vsanStretchInclude==='Include' },
          { key:'vsanWitnessDns2',    label:'Witness DNS Server #2',       type:'ip',   sample:'10.21.10.5', showWhen:f=>f.vsanStretchInclude==='Include', notes:'Should be in a different fault domain to DNS Server 1' },
          { key:'vsanWitnessNtp',     label:'Witness NTP Server',          type:'text', sample:'ntp.lax.rainpole.io', required:true, showWhen:f=>f.vsanStretchInclude==='Include' },
          { key:'vsanWitnessRootPw',  label:'Witness Root Password',       type:'password', sample:'AUTO-GENERATED', required:true, showWhen:f=>f.vsanStretchInclude==='Include' },
        ]
      },
    ]
  },

  // ─── FLEET MANAGEMENT DAY-N ───
  {
    id:'fleet-day-n', title:'Fleet Management Day-N', icon:'🔧', group:'fleet',
    subtitle:'Day-2 operations — VCF Operations, Automation, Logs, Identity',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Fleet CIDR & Global Settings',
        fields:[
          { key:'fleetCidr',    label:'Fleet Deployment CIDR',    type:'select',
            options:['198.18.0.0/15','240.0.0.0/15','250.0.0.0/15'],
            sample:'198.18.0.0/15', required:true, notes:'Non-routable CIDR used for fleet component communication' },
          { key:'fleetMtu',     label:'Fleet MTU',                type:'number', sample:'1500',
            notes:'Standard Ethernet MTU (1500) is sufficient for fleet management traffic; jumbo frames are not required.' },
        ]
      },
      {
        title:'VCF Operations',
        fields:[
          { key:'vcfOpsAutoMode',  label:'Deploy VCF Operations / Automation', type:'select', options:['Exclude','Deploy VCF Operations and Automation','Deploy VCF Automation'], sample:'Exclude',
            notes:'Day-N (deferred) deployment only — VCF Operations itself is normally deployed at bring-up by the VCF Installer (see Deploy Management Domain → VCF Operations). "Deploy VCF Automation" deploys Automation only, using VCF Operations as its API transport — VCF Operations itself is not provisioned in that mode. Day-N deployment is API-only (SDDC Manager API / VCF JSON Generator).' },
          { key:'vcfOpsHaMode',    label:'VCF Operations HA Mode',  type:'select', options:['Single Node','HA Cluster'], sample:'HA Cluster', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsPrimaryFqdn', label:'VCF Operations Primary Node FQDN', type:'text', sample:'sfo-m01-vrops01a.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsPrimaryIp',   label:'VCF Operations Primary Node IP',   type:'ip',   sample:'10.11.99.52', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsReplicaFqdn', label:'VCF Operations Replica Node FQDN', type:'text', sample:'sfo-m01-vrops01b.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsReplicaIp',   label:'VCF Operations Replica Node IP',   type:'ip',   sample:'10.11.99.53', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsDataFqdn',    label:'VCF Operations Data Node FQDN',    type:'text', sample:'sfo-m01-vrops01c.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsDataIp',      label:'VCF Operations Data Node IP',      type:'ip',   sample:'10.11.99.54', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsLbFqdn',      label:'VCF Operations Load Balancer FQDN', type:'text', sample:'sfo-m01-vrops01.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation', notes:'Optional in Single Node mode — useful for connecting an external load balancer in HA Cluster mode' },
          { key:'vcfOpsLbIp',        label:'VCF Operations Load Balancer IP',  type:'ip',   sample:'10.11.99.21', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsSize',      label:'VCF Operations Size',     type:'select', options:['Small','Medium','Large'], sample:'Small', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'vcfOpsAdminPw',   label:'Admin Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
        ]
      },
      {
        title:'VCF Automation',
        description:'VCF Automation 9.1 requires 1 FQDN for its VIP, 1 FQDN for its dedicated VCF Services Runtime, and a /29 block of 5 IPs for its nodes (separate from the fleet-level VCF Services Runtime IP block under VCF Management Services).',
        fields:[
          { key:'vcfAutoFqdn',     label:'VCF Automation FQDN (VIP)', type:'text',   sample:'sfo-m01-vra01.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation',
            notes:'1 FQDN for the VCF Automation VIP. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'vcfAutoInstallType', label:'Installation Type', type:'select', options:['New','Import 8.x appliance'], sample:'New', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoIp',       label:'VCF Automation IP (VIP)',  type:'ip',     sample:'10.11.99.25', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoSvcRuntimeFqdn', label:'VCF Automation — Dedicated VCF Services Runtime FQDN', type:'text', sample:'sfo-vra-sr01.sfo.rainpole.io', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation',
            notes:'1 dedicated VCF Services Runtime FQDN for VCF Automation, separate from the fleet-level "VCF Services Runtime FQDN" under VCF Management Services. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'vcfAutoSvcRuntimeIp',   label:'VCF Automation — Dedicated VCF Services Runtime IP',   type:'ip',   sample:'10.11.99.45', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoIpPool1',  label:'VCF Automation Node IP Pool — Address 1', type:'ip',   sample:'10.11.99.46', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation',
            notes:'VCF Automation 9.1 nodes use a dedicated /29 block of 5 IP addresses (this field + the 4 below): 3 are assigned to the VCF Automation nodes and the remaining 2 are kept as a buffer for redeploy / rolling-update operations. By default the nodes are deployed on the VM management network; they can alternatively be placed on a dedicated VLAN via the fleet lifecycle API.' },
          { key:'vcfAutoIpPool2',  label:'VCF Automation Node IP Pool — Address 2', type:'ip',   sample:'10.11.99.47', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoIpPool3',  label:'VCF Automation Node IP Pool — Address 3', type:'ip',   sample:'10.11.99.48', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoIpPool4',  label:'VCF Automation Node IP Pool — Address 4 (buffer)', type:'ip',   sample:'10.11.99.49', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoIpPool5',  label:'VCF Automation Node IP Pool — Address 5 (buffer)', type:'ip',   sample:'10.11.99.50', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
          { key:'vcfAutoAdminPw',  label:'Admin Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation'||f.vcfOpsAutoMode==='Deploy VCF Automation' },
        ]
      },
      {
        title:'Deploy Deferred Components (API-only)', amber:true,
        description:'Only supported via API (SDDC Manager API / VCF JSON Generator) — these options are not visible in the VCF Installer UI.',
        showWhen:f=>f.vcfOpsAutoMode!=='Exclude',
        fields:[
          { key:'deferredCustomPassword',     label:'Customize appliance password during install',            type:'toggle', options:['Selected','Unselected'], sample:'Unselected' },
          { key:'deferredCustomProxyNetwork', label:'Customize proxy portgroup and networking during install', type:'toggle', options:['Selected','Unselected'], sample:'Unselected' },
          { key:'deferredCustomSizing',       label:'Customize appliance sizing during install',               type:'toggle', options:['Selected','Unselected'], sample:'Unselected',
            notes:'Use VCF.JSONGenerator to generate the JSON file once PnP is complete.', docLink:'https://github.com/vmware/powershell-module-for-vmware-cloud-foundation-jsongenerator', docLabel:'VCF JSON Generator (GitHub)' },
        ]
      },
      {
        title:'Log Management',
        description:'Log Management (VCF Operations for Logs) requires 1 FQDN. Its IP addresses are not separate allocations in the Management VM Network or Fleet VLAN — they are drawn from the VCF Services Runtime IP block (see "VCF Services Runtime IP" under VCF Management Services): 6 IPs for the initial deployment, plus 2 IPs for every additional replica beyond the first (set via "Log Management Replicas" on the Management Domain Sizing page).',
        fields:[
          { key:'vcfLogsInclude',  label:'Include Log Management',  type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'vcfLogsHaMode',   label:'Log Management HA Mode',  type:'select', options:['Single Node','HA Cluster'], sample:'Single Node', showWhen:f=>f.vcfLogsInclude==='Include' },
          { key:'vcfLogsFqdn',     label:'Log Management FQDN', type:'text',   sample:'sfo-m01-vrli01a.sfo.rainpole.io', showWhen:f=>f.vcfLogsInclude==='Include',
            notes:'1 FQDN for Log Management. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'vcfLogsIp',       label:'Log Management IP',   type:'ip',     sample:'10.11.99.43', showWhen:f=>f.vcfLogsInclude==='Include',
            notes:'First of the 6 IPs allocated from the VCF Services Runtime IP block for the initial Log Management deployment.' },
          { key:'vcfLogsReplicaFqdn', label:'Log Management Replica Node FQDN', type:'text', sample:'sfo-m01-vrli01b.sfo.rainpole.io', showWhen:f=>f.vcfLogsInclude==='Include' && f.vcfLogsHaMode==='HA Cluster' },
          { key:'vcfLogsReplicaIp',   label:'Log Management Replica Node IP',   type:'ip',   sample:'10.11.99.44', showWhen:f=>f.vcfLogsInclude==='Include' && f.vcfLogsHaMode==='HA Cluster',
            notes:'Part of the same VCF Services Runtime IP block — each additional replica beyond the first consumes 2 more IPs from that block (1 for Small/Medium replicas, 2 for Large).' },
          { key:'vcfLogsLbFqdn',      label:'Log Management Additional VIP FQDN', type:'text', sample:'sfo-m01-vrli01.sfo.rainpole.io', showWhen:f=>f.vcfLogsInclude==='Include' && f.vcfLogsHaMode==='HA Cluster',
            notes:'Optional additional Virtual IP, created post-deployment on the Integrated Load Balancer tab of the Log Collection configuration. Its IP is also allocated from the VCF Services Runtime IP block, not a separate Management VM Network / Fleet VLAN address.' },
          { key:'vcfLogsLbIp',        label:'Log Management Additional VIP IP',   type:'ip',   sample:'10.11.99.45', showWhen:f=>f.vcfLogsInclude==='Include' && f.vcfLogsHaMode==='HA Cluster' },
          { key:'vcfLogsSize',     label:'Log Management Size',     type:'select', options:['Small','Medium','Large'], sample:'Small', showWhen:f=>f.vcfLogsInclude==='Include' },
          { key:'vcfLogsAdminPw',  label:'Admin Password',          type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.vcfLogsInclude==='Include' },
        ]
      },
      {
        title:'VCF Operations for Networks (NSX-T Intelligence)',
        showWhen: f => f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'vcfNetOpsInclude', label:'Include VCF Operations for Networks', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'vcfNetOpsFqdn',    label:'VCF Ops for Networks FQDN',           type:'text', sample:'sfo-m01-vvrni01.sfo.rainpole.io', showWhen:f=>f.vcfNetOpsInclude==='Include' },
          { key:'vcfNetOpsIp',      label:'VCF Ops for Networks IP',             type:'ip',   sample:'10.11.99.44', showWhen:f=>f.vcfNetOpsInclude==='Include' },
          { key:'vcfNetOpsPlatformIpv4',  label:'Platform Node IPv4',            type:'ip',   sample:'10.11.99.60', showWhen:f=>f.vcfNetOpsInclude==='Include', notes:'IP address must reside within the same subnet as VCF Operations — the UI deployment method does not allow choosing a different network or vDPG' },
          { key:'vcfNetOpsPlatformIpv6',  label:'Platform Node IPv6 (optional)', type:'ip',   sample:'', showWhen:f=>f.vcfNetOpsInclude==='Include' },
          { key:'vcfNetOpsCollectorIpv4', label:'Collector Node IPv4',           type:'ip',   sample:'10.11.99.61', showWhen:f=>f.vcfNetOpsInclude==='Include' },
          { key:'vcfNetOpsCollectorIpv6', label:'Collector Node IPv6 (optional)', type:'ip',  sample:'', showWhen:f=>f.vcfNetOpsInclude==='Include' },
        ]
      },
      {
        title:'Identity Broker (Workspace ONE / vIDM)',
        fields:[
          { key:'idBrokerInclude', label:'Include Identity Broker', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'idBrokerFqdn',    label:'Identity Broker FQDN',    type:'text', sample:'sfo-m01-idm01.sfo.rainpole.io', showWhen:f=>f.idBrokerInclude==='Include',
            notes:'1 FQDN. In the First VCF Instance this is one of the required Day-0 FQDNs alongside the Fleet Components, Instance Components, and VCF Services Runtime FQDNs (VCF Management Services section below). Do not use capital letters in the FQDN (lowercase only).' },
          { key:'idBrokerIp',      label:'Identity Broker IP',      type:'ip',     sample:'10.11.99.23', showWhen:f=>f.idBrokerInclude==='Include' },
          { key:'idBrokerSize',    label:'Identity Broker Size',    type:'select', options:['Small','Medium','Large','Extra-Large'], sample:'Medium', showWhen:f=>f.idBrokerInclude==='Include' },
        ]
      },
      {
        title:'VCF Management Services',
        description:'Fleet- and instance-level lifecycle components hosted on the VCF Services Runtime: Fleet Components, Instance Components and VCF Services Runtime each need 1 FQDN/IP, allocated from the VCF Services Runtime IP block. That block must sit on the VCF Management Network and provide a minimum of 12 IPs (/28) for the initial deployment, up to a recommended maximum of 30 IPs (/27) to leave room for Day-N scale-out — Log Management and Real-time Metrics IPs are also drawn from this same block (see the Log Management section above). License Server has its own FQDN/IP on the VCF Management Network and is tracked separately — it is not part of the VCF Management Services FQDN set (Fleet Components, Instance Components, VCF Services Runtime, Identity Broker).',
        fields:[
          { key:'fleetComponentsFqdn',    label:'Fleet Components FQDN',     type:'text', sample:'flt-fc01.rainpole.io',
            notes:'1 FQDN to access the hosted fleet-level components which do not require a separate FQDN, for example, the fleet lifecycle component. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'fleetComponentsIp',      label:'Fleet Components IP',       type:'ip',   sample:'10.11.99.20' },
          { key:'instanceComponentsFqdn', label:'Instance Components FQDN',  type:'text', sample:'sfo-ic01.sfo.rainpole.io',
            notes:'1 FQDN to access the hosted instance-level components which do not require a separate FQDN, for example, the SDDC lifecycle and real-time metrics components. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'instanceComponentsIp',   label:'Instance Components IP',    type:'ip',   sample:'10.11.99.11' },
          { key:'vcfSvcRuntimeFqdn',      label:'VCF Services Runtime FQDN', type:'text', sample:'sfo-sr01.sfo.rainpole.io',
            notes:'1 FQDN to access the VCF services runtime component to troubleshoot issues, restart components, etc. The hostname from this FQDN is prefixed to the names of its node VMs and related objects. Do not use capital letters in the FQDN (lowercase only).' },
          { key:'vcfSvcRuntimeIp',        label:'VCF Services Runtime IP',   type:'ip',   sample:'10.11.99.10',
            notes:'First address of the VCF Services Runtime IP block. The block must be on the VCF Management Network with a minimum of 12 IPs (/28) for the initial deployment; reserve up to 30 IPs (/27) if Day-N components and scale-out (additional Log Management replicas, Real-time Metrics, etc.) are planned.' },
          { key:'licenseServerFqdn',      label:'License Server FQDN',       type:'text', sample:'flt-lc01.rainpole.io',
            notes:'1 FQDN, fleet-level and portable, on the VCF Management Network. Separate from the VCF Management Services FQDN set above (Fleet Components, Instance Components, VCF Services Runtime, Identity Broker) — not allocated from the VCF Services Runtime IP block.' },
          { key:'licenseServerIp',        label:'License Server IP',         type:'ip',   sample:'10.11.99.22' },
          { key:'mgmtSvcAdditionalIp1', label:'Additional IP #1', type:'ip', sample:'10.11.99.30',
            notes:'Spare IP addresses reserved within the VCF Services Runtime IP block (/28 minimum, /27 recommended) for future component scale-out — e.g. additional Log Management replicas, Real-time Metrics, or other fleet-/instance-level services added post-deployment.' },
          { key:'mgmtSvcAdditionalIp2', label:'Additional IP #2', type:'ip', sample:'10.11.99.31' },
          { key:'mgmtSvcAdditionalIp3', label:'Additional IP #3', type:'ip', sample:'10.11.99.32' },
          { key:'vcfMgmtSvcSshPw',        label:'SSH Password (vmware-system-user)', type:'password', sample:'AUTO-GENERATED',
            notes:'Shared SSH credential for the vmware-system-user account on VCF Management Services runtime nodes.' },
        ]
      },
      {
        title:'Authentication (AD/LDAP)',
        fields:[
          { key:'adType',        label:'AD / LDAP Type',            type:'select', options:['AD/LDAP','Open LDAP'], sample:'AD/LDAP' },
          { key:'adLdapAttr',    label:'LDAP Login Attribute',      type:'select', options:['sAMAccountName','userPrincipalName'], sample:'sAMAccountName' },
        ]
      },
    ]
  },

  // ─── ACTIVE DIRECTORY ───
  {
    id:'active-directory', title:'Active Directory Inputs', icon:'👥', group:'fleet',
    subtitle:'AD / LDAP identity configuration for all VCF components',
    sections:[
      {
        title:'Active Directory / LDAP Configuration',
        fields:[
          { key:'adInclude', label:'Configure Active Directory / LDAP', type:'toggle', options:['Include','Exclude'], sample:'Exclude',
            notes:'Include to fill in detailed parent/child domain, security group, and service account inputs on this page. Exclude if AD/LDAP is already deployed and documented externally.' },
        ]
      },
      {
        title:'Parent Domain',
        fields:[
          { key:'adParentFqdn',     label:'Parent Domain FQDN',      type:'text', sample:'rainpole.io', required:true, showWhen:f=>f.adInclude==='Include' },
          { key:'adParentNetbios',  label:'Parent NETBIOS Name',      type:'text', sample:'RAINPOLE', required:true, showWhen:f=>f.adInclude==='Include' },
          { key:'adParentAdminUser',label:'Admin User (UPN)',          type:'text', sample:'administrator@rainpole.io', required:true, showWhen:f=>f.adInclude==='Include' },
          { key:'adParentAdminPass',label:'Admin Password',            type:'password', sample:'AUTO-GENERATED', required:true, showWhen:f=>f.adInclude==='Include' },
          { key:'adParentBaseDn',   label:'Base DN',                  type:'text', sample:'dc=rainpole,dc=io', required:true, showWhen:f=>f.adInclude==='Include' },
          { key:'adParentSecGrpOu', label:'Security Groups OU',       type:'text', sample:'ou=Security Groups,dc=rainpole,dc=io', showWhen:f=>f.adInclude==='Include' },
          { key:'adParentSecUsrOu', label:'Security Users OU',        type:'text', sample:'ou=Security Users,dc=rainpole,dc=io', showWhen:f=>f.adInclude==='Include' },
        ]
      },
      {
        title:'Child Domain',
        showWhen: f=>f.adInclude==='Include',
        fields:[
          { key:'adChildFqdn',      label:'Child Domain FQDN',        type:'text', sample:'sfo.rainpole.io', required:true },
          { key:'adChildNetbios',   label:'Child NETBIOS Name',        type:'text', sample:'SFO', required:true },
          { key:'adChildBaseDn',    label:'Child Base DN',             type:'text', sample:'dc=sfo,dc=rainpole,dc=io', required:true },
          { key:'adChildSecGrpOu',  label:'Child Security Groups OU',  type:'text', sample:'ou=Security Groups,dc=sfo,dc=rainpole,dc=io' },
          { key:'adBindUser',       label:'Bind User (UPN)',           type:'text', sample:'svc-vcf-ad@sfo.rainpole.io', required:true },
          { key:'adBindPass',       label:'Bind Password',             type:'password', sample:'AUTO-GENERATED', required:true },
          { key:'adDcFqdn',         label:'Domain Controller FQDN',   type:'text', sample:'sfo-rpl-dc01.sfo.rainpole.io', required:true },
          { key:'adDcIp',           label:'Domain Controller IP',     type:'ip',   sample:'10.11.0.2', required:true },
        ]
      },
      {
        title:'VCF Security Groups',
        description:'AD security groups used for role-based access control in VCF components.',
        showWhen: f=>f.adInclude==='Include',
        fields:[
          { key:'sgVcfAdmins',              label:'VCF Administrators Group',         type:'text', sample:'gg-vcf-admins' },
          { key:'sgVcfUsers',               label:'VCF Read-Only Group',              type:'text', sample:'gg-vcf-readonly' },
          { key:'sgVcenterAdmins',          label:'vCenter Admins Group',             type:'text', sample:'gg-vcenter-admins' },
          { key:'sgNsxAdmins',              label:'NSX Admins Group',                 type:'text', sample:'gg-nsx-admins', showWhen:f=>f.deploymentType==='VMware Cloud Foundation' },
          { key:'sgOpsAdmins',              label:'VCF Operations Admins Group',      type:'text', sample:'gg-vrops-admins', showWhen:f=>f.vcfOpsAutoMode==='Deploy VCF Operations and Automation' },
          { key:'ggLcmAdmins',              label:'LCM Admins Group',                 type:'text', sample:'gg-lcm-admins' },
          { key:'ggIdmAdmins',              label:'IDM Admins Group',                 type:'text', sample:'gg-idm-admins' },
          { key:'ggOpsContentAdmins',       label:'Ops Content Admins Group',         type:'text', sample:'gg-ops-content-admins' },
          { key:'ggNetworksAdmin',          label:'Networks Admin Group',             type:'text', sample:'gg-networks-admin' },
          { key:'ggCmpCloudAssemblyAdmins', label:'CMP Cloud Assembly Admins Group',  type:'text', sample:'gg-cmp-cloud-assembly-admins' },
        ]
      },
      {
        title:'Service Accounts (VCF Components)',
        showWhen: f=>f.adInclude==='Include',
        fields:[
          { key:'svcVcfAd',      label:'svc-vcf-ad (AD Integration)',     type:'text', sample:'svc-vcf-ad@rainpole.io' },
          { key:'svcOpsVcf',     label:'svc-ops-vcf (VCF Operations)',    type:'text', sample:'svc-ops-vcf@rainpole.io' },
          { key:'svcCmpVsphere', label:'svc-cmp-vsphere (Cloud Assembly)', type:'text', sample:'svc-cmp-vsphere@rainpole.io' },
          { key:'svcLogsAd',     label:'svc-logs-ad (Log Management)',    type:'text', sample:'svc-logs-ad@rainpole.io' },
          { key:'svcHcxNsx',     label:'svc-hcx-nsx (HCX)',              type:'text', sample:'svc-hcx-nsx@rainpole.io', showWhen:f=>f.ccmInclude==='Include' },
        ]
      },
    ]
  },

  // ─── DEPLOY WORKLOAD DOMAIN ───
  {
    id:'deploy-wld', title:'Deploy Workload Domain', icon:'🌐', group:'wld',
    subtitle:'VI Workload Domain deployment configuration',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Workload Domain Selection',
        fields:[
          { key:'wldInclude',    label:'Deploy Workload Domain',   type:'toggle', options:['Include','Exclude'], sample:'Include' },
          { key:'wldName',       label:'Workload Domain Name',     type:'text',   sample:'sfo-w01', required:true, showWhen:f=>f.wldInclude!=='Exclude' },
          { key:'wldType',       label:'Domain Type',             type:'select', options:['Workload Domain','MGMT Workload Domain'], sample:'Workload Domain', showWhen:f=>f.wldInclude!=='Exclude' },
          { key:'wldStorageType',label:'Principal Storage',        type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/design/vmware-cloud-foundation-concepts/storage-models.html', docLabel:'VCF Storage Models (TechDocs)', options:['vSAN-ESA','vSAN-OSA','vSAN Compute Cluster','vSAN Storage Cluster','VMFS on Fibre Channel (FC)','NFSv3'], sample:'vSAN-ESA', showWhen:f=>f.wldInclude!=='Exclude' },
          { key:'wldVsanFtt',    label:'vSAN FTT',                type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-planning-and-deployment/designing-and-sizing-a-virtual-san-cluster/design-considerations-for-a-virtual-san-cluster.html', docLabel:'vSAN Cluster Design Considerations (TechDocs)', options:['1','2','3'], sample:'1', showWhen:f=>f.wldInclude!=='Exclude'&&f.wldStorageType&&f.wldStorageType.startsWith('vSAN') },
        ]
      },
      {
        title:'WLD General Information',
        showWhen: f => f.wldInclude!=='Exclude',
        fields:[
          { key:'wldVcFqdn',     label:'WLD vCenter FQDN',        type:'text', sample:'sfo-w01-vc01.sfo.rainpole.io', required:true },
          { key:'wldVcIp',       label:'WLD vCenter IP',          type:'ip',   sample:'10.13.10.3', required:true },
          { key:'wldVcDatacenter', label:'WLD Datacenter Name',   type:'text', sample:'sfo-w01-dc01' },
          { key:'wldVcCluster',  label:'WLD Cluster Name',        type:'text', sample:'sfo-w01-cl01' },
          { key:'wldVcDatastore', label:'WLD vSAN Datastore',     type:'text', sample:'sfo-w01-cl01-ds-vsan01' },
          { key:'wldVcAdminPw',  label:'vCenter Admin Password',  type:'password', sample:'AUTO-GENERATED' },
          { key:'wldVcModel', label:'vCenter Model',           type:'select', options:['Shared','Dedicated'], sample:'Shared', notes:'Shared reuses the Management Domain vCenter; Dedicated deploys a separate VCSA for this workload domain.' },
          { key:'wldVcSize',  label:'WLD vCenter Appliance Size', type:'select', options:['Tiny','Small','Medium','Large','XLarge'], sample:'Small', showWhen:f=>f.wldVcModel==='Dedicated', notes:'Size the dedicated VCSA based on the number of hosts/VMs it will manage — see VCF Fleet Sizing Models.', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/vmware-cloud-foundation-concepts/vcf-fleet-sizing-models(1).html', docLabel:'VCF Fleet Sizing Models (TechDocs)' },
          { key:'wldVcStorageTier', label:'WLD vCenter Storage Tier', type:'select', options:['Default','Large','XLarge'], sample:'Default', showWhen:f=>f.wldVcModel==='Dedicated', notes:'Increase the storage tier if you plan to retain longer task/event/stats history on this vCenter.' },
        ]
      },
      {
        title:'WLD Hosts',
        showWhen: f => f.wldInclude!=='Exclude',
        description:'Minimum 3 hosts for WLD cluster.',
        fields: makeHostFields(16,'w01','10.13.10','1310'),
      },
      {
        title:'WLD Networks',
        showWhen: f => f.wldInclude!=='Exclude',
        fields:[
          ...makeNetFields('wldEsxMgmt',  'WLD ESX Mgmt',   1310, '10.13.10.1', '10.13.10.0/24', 1500, true),
          ...makeNetFields('wldVmMgmt',   'WLD VM Mgmt',    1311, '10.13.11.1', '10.13.11.0/24', 1500, true),
          ...makeNetFields('wldVmotion',  'WLD vMotion',    1313, '10.13.13.1', '10.13.13.0/24', 9000, true),
          ...makeNetFields('wldVsan',     'WLD vSAN',       1314, '10.13.14.1', '10.13.14.0/24', 9000, true),
          ...makeNetFields('wldOverlay',  'WLD Overlay',    1316, '10.13.16.1', '10.13.16.0/24', 9000, true),
        ]
      },
      {
        title:'WLD NFS Storage Network',
        showWhen: f => f.wldInclude!=='Exclude' && f.wldStorageType==='NFSv3',
        fields:[
          ...makeNetFields('wldNfs', 'WLD NFS', 1317, '10.13.17.1', '10.13.17.0/24', 9000, false),
          { key:'wldNfsServer',  label:'NFS Server FQDN/IP',  type:'text',   sample:'nfs.sfo.rainpole.io', required:true },
          { key:'wldNfsShare',   label:'NFS Share Path',      type:'text',   sample:'/vol/wld01' },
          { key:'wldNfsVmknic',  label:'NFS vmknic Binding',  type:'select', options:['Enabled','Disabled'], sample:'Disabled' },
        ]
      },
      {
        title:'WLD NSX Configuration',
        showWhen: f => f.wldInclude!=='Exclude' && f.deploymentType==='VMware Cloud Foundation',
        fields:[
          { key:'wldNsxModel', label:'NSX Model',               type:'select', options:['Shared (use Management NSX)','Dedicated - Single Node','Dedicated - HA Cluster'], sample:'Shared (use Management NSX)' },
          { key:'wldNsxVipFqdn', label:'WLD NSX VIP FQDN',     type:'text', sample:'sfo-w01-nsx01.sfo.rainpole.io', showWhen:f=>f.wldNsxModel&&f.wldNsxModel!=='Shared (use Management NSX)' },
          { key:'wldNsxVipIp',   label:'WLD NSX VIP IP',       type:'ip',   sample:'10.13.10.74', showWhen:f=>f.wldNsxModel&&f.wldNsxModel!=='Shared (use Management NSX)' },
        ]
      },
    ]
  },

  // ─── CONFIGURE WORKLOAD DOMAIN ───
  {
    id:'configure-wld', title:'Configure Workload Domain', icon:'🔩', group:'wld',
    subtitle:'Post-deployment WLD configuration',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation' && f.wldInclude!=='Exclude',
    sections:[
      {
        title:'WLD Certificate Authority',
        fields:[
          { key:'wldCaType',        label:'WLD Certificate Authority',    type:'select', options:['Exclude','Microsoft CA','OpenSSL CA'], sample:'Microsoft CA' },
          { key:'wldCaFqdn',        label:'WLD CA Server FQDN',           type:'text',   sample:'rpl-dc01.rainpole.io', showWhen:f=>f.wldCaType&&f.wldCaType!=='Exclude' },
          { key:'wldCaAdminUser',   label:'WLD CA Admin Username',        type:'text',   sample:'svc-vcf-ca@rainpole.io', showWhen:f=>f.wldCaType&&f.wldCaType!=='Exclude' },
          { key:'wldCaAdminPass',   label:'WLD CA Admin Password',        type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.wldCaType&&f.wldCaType!=='Exclude' },
          { key:'wldCaTemplate',    label:'WLD Certificate Template',     type:'text',   sample:'VMwareWebServer', showWhen:f=>f.wldCaType==='Microsoft CA' },
          { key:'wldCertKeySize',   label:'WLD Key Size',                 type:'select', options:['2048','3072','4096'], sample:'2048', showWhen:f=>f.wldCaType&&f.wldCaType!=='Exclude' },
          { key:'wldCaOrgName',     label:'WLD Organization Name',        type:'text',   sample:'Rainpole Inc.', showWhen:f=>f.wldCaType==='OpenSSL CA' },
          { key:'wldCaOrgUnit',     label:'WLD Org Unit',                 type:'text',   sample:'IT', showWhen:f=>f.wldCaType==='OpenSSL CA' },
        ]
      },
      {
        title:'WLD NSX Network Connectivity',
        fields:[
          { key:'wldNsxConnectivity',  label:'WLD NSX Connectivity',    type:'select', options:['Exclude','Centralized Connectivity','Distributed Connectivity'], sample:'Centralized Connectivity' },
          { key:'wldNsxT0Name',        label:'WLD Tier-0 Gateway',      type:'text',   sample:'sfo-w01-ec01-t0-gw01', showWhen:f=>f.wldNsxConnectivity&&f.wldNsxConnectivity!=='Exclude' },
          { key:'wldNsxT0Asn',         label:'WLD T0 BGP ASN',          type:'number', sample:'65002', showWhen:f=>f.wldNsxConnectivity&&f.wldNsxConnectivity!=='Exclude' },
          { key:'wldEdgeHaMode',       label:'WLD Edge HA Mode',        type:'select', options:['Active-Active','Active-Standby'], sample:'Active-Standby', showWhen:f=>f.wldNsxConnectivity&&f.wldNsxConnectivity!=='Exclude' },
          { key:'wldNsxExtIpBlock',    label:'WLD External IP Block',   type:'cidr',   sample:'192.168.12.0/24', showWhen:f=>f.wldNsxConnectivity&&f.wldNsxConnectivity!=='Exclude' },
        ]
      },
      {
        title:'WLD vSphere Supervisor',
        fields:[
          { key:'wldSupervisorInclude',       label:'Enable WLD Supervisor',       type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'wldSupervisorCluster',       label:'WLD Supervisor Cluster',      type:'text',   sample:'sfo-w01-cl01', showWhen:f=>f.wldSupervisorInclude==='Include' },
          { key:'wldSupervisorStoragePolicy', label:'WLD Storage Policy',          type:'text',   sample:'sfo-w01-cl01-vsan-policy', showWhen:f=>f.wldSupervisorInclude==='Include' },
          { key:'wldSupervisorContentLib',    label:'WLD Content Library',         type:'text',   sample:'sfo-w01-cl01-lib01', showWhen:f=>f.wldSupervisorInclude==='Include' },
          { key:'wldSupervisorLbType',        label:'WLD Load Balancer Type',      type:'select', options:['AVI (NSX ALB)','HAProxy','NSX'], sample:'AVI (NSX ALB)', showWhen:f=>f.wldSupervisorInclude==='Include' },
          { key:'wldSupervisorCidr',          label:'WLD Ingress CIDR',            type:'cidr',   sample:'192.168.50.0/24', showWhen:f=>f.wldSupervisorInclude==='Include' },
          { key:'wldEgressCidr',              label:'WLD Egress CIDR',             type:'cidr',   sample:'192.168.51.0/24', showWhen:f=>f.wldSupervisorInclude==='Include' },
        ]
      },
    ]
  },

  // ─── DEPLOY CLUSTER ───
  {
    id:'deploy-cluster', title:'Deploy Additional Cluster', icon:'🖥️', group:'cluster',
    subtitle:'Add compute clusters to existing domains',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Cluster Selection',
        fields:[
          { key:'clusterInclude',   label:'Deploy Additional Cluster',  type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'clusterDomain',    label:'Target Workload Domain',      type:'text',   sample:'sfo-w01', showWhen:f=>f.clusterInclude==='Include' },
          { key:'clusterName',      label:'Cluster Name',               type:'text',   sample:'sfo-w01-cl02', showWhen:f=>f.clusterInclude==='Include' },
          { key:'clusterType',      label:'Cluster Type',               type:'select', options:['Single-Rack','Multi-Rack L3'], sample:'Single-Rack', showWhen:f=>f.clusterInclude==='Include' },
          { key:'clusterHostCount', label:'Number of Hosts',            type:'number', sample:'4', showWhen:f=>f.clusterInclude==='Include' },
          { key:'clusterStorage',   label:'Principal Storage',          type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/design/vmware-cloud-foundation-concepts/storage-models.html', docLabel:'VCF Storage Models (TechDocs)', options:['vSAN-ESA','vSAN-OSA','vSAN Compute Cluster','vSAN Storage Cluster','VMFS on Fibre Channel (FC)','NFSv3'], sample:'vSAN-ESA', showWhen:f=>f.clusterInclude==='Include' },
          { key:'clusterVsanFtt',   label:'vSAN FTT',                  type:'select', docLink:'https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-planning-and-deployment/designing-and-sizing-a-virtual-san-cluster/design-considerations-for-a-virtual-san-cluster.html', docLabel:'vSAN Cluster Design Considerations (TechDocs)', options:['1','2','3'], sample:'1', showWhen:f=>f.clusterInclude==='Include'&&f.clusterStorage&&f.clusterStorage.startsWith('vSAN') },
        ]
      },
      {
        title:'Cluster Hosts',
        showWhen: f => f.clusterInclude==='Include',
        fields: makeHostFields(16,'w01cl02','10.14.10','1410'),
      },
      {
        title:'Cluster NIC Teaming',
        showWhen: f => f.clusterInclude==='Include',
        fields:[
          { key:'clusterTeaming',   label:'Teaming Policy',     type:'select',
            options:['Route based on IP hash','Route based on source MAC hash','Route based on source port ID','Use explicit failover order','Route Based on Physical NIC Load'],
            sample:'Route based on IP hash' },
          { key:'clusterUplink1State', label:'Uplink 1 State',  type:'select', options:['Active','Standby','Unused'], sample:'Active' },
          { key:'clusterUplink2State', label:'Uplink 2 State',  type:'select', options:['Active','Standby','Unused'], sample:'Active' },
          { key:'clusterLacpEnabled',  label:'LACP Enabled',    type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
        ]
      },
      {
        title:'IP Pool Configuration',
        showWhen: f => f.clusterInclude==='Include',
        fields:[
          { key:'clusterNetPoolReuse', label:'VCF Network Pool',      type:'select', options:['Re-use an existing VCF Network Pool','Create a new VCF Network Pool'], sample:'Create a new VCF Network Pool' },
          { key:'clusterIpPoolReuse',  label:'IP Pool',               type:'select', options:['Re-use an existing Pool','Create New Static IP Pool'], sample:'Create New Static IP Pool' },
          { key:'clusterNetPoolName',  label:'Network Pool Name',     type:'text',   sample:'sfo-w01-np02', showWhen:f=>f.clusterNetPoolReuse&&f.clusterNetPoolReuse.includes('Create') },
        ]
      },
      {
        title:'Cluster Network Configuration',
        showWhen: f => f.clusterInclude==='Include' && f.clusterNetPoolReuse && f.clusterNetPoolReuse.includes('Create'),
        description:'Network settings for the new VCF Network Pool attached to this cluster.',
        fields:[
          ...makeNetFields('clusterVmotion',  'Cluster vMotion',  1413, '10.14.13.1', '10.14.13.0/24', 9000, true),
          ...makeNetFields('clusterVsan',     'Cluster vSAN',     1414, '10.14.14.1', '10.14.14.0/24', 9000, true),
          ...makeNetFields('clusterOverlay',  'Cluster Overlay',  1416, '10.14.16.1', '10.14.16.0/24', 9000, true),
        ]
      },
      {
        title:'Cluster Networks — NFS',
        showWhen: f => f.clusterInclude==='Include' && f.clusterStorage==='NFSv3',
        fields:[
          ...makeNetFields('clusterNfs', 'Cluster NFS', 1415, '10.14.15.1', '10.14.15.0/24', 9000, true),
          { key:'clusterNfsServer',        label:'NFS Server IP/FQDN',  type:'text',   sample:'nfs.sfo.rainpole.io', required:true },
          { key:'clusterNfsPath',          label:'NFS Mount Path',      type:'text',   sample:'/vcf/cl02' },
          { key:'clusterNfsVmknicBinding', label:'NFS vmknic Binding',  type:'select', options:['Enabled','Disabled'], sample:'Disabled' },
        ]
      },
    ]
  },

  // ─── ADDITIONAL RACKS ───
  {
    id:'additional-racks', title:'Additional Racks (Multi-Rack L3)', icon:'🔌', group:'cluster',
    subtitle:'Network configuration for up to 7 additional racks in L3 topology',
    showWhen: f => f.clusterType==='Multi-Rack L3',
    sections: [2,3,4,5,6,7,8].map(r => makeRackFields(r)),
  },

  // ─── SITE PROTECTION & DR ───
  {
    id:'site-dr', title:'Site Protection & DR', icon:'🛡️', group:'recovery',
    subtitle:'VMware Live Recovery — vSphere Replication & SRM configuration',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Site Protection & Recovery',
        fields:[
          { key:'drInclude',       label:'Include Site Protection & DR', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'drSrmFqdn',       label:'VMware Live Recovery (SRM) FQDN', type:'text',   sample:'sfo-m01-srm01.sfo.rainpole.io', showWhen:f=>f.drInclude==='Include' },
          { key:'drSrmIp',         label:'VMware Live Recovery (SRM) IP', type:'ip',     sample:'10.11.10.126', showWhen:f=>f.drInclude==='Include' },
          { key:'drVrFqdn',        label:'vSphere Replication FQDN',     type:'text',   sample:'sfo-m01-vrms01.sfo.rainpole.io', showWhen:f=>f.drInclude==='Include' },
          { key:'drVrIp',          label:'vSphere Replication IP',       type:'ip',     sample:'10.11.10.125', showWhen:f=>f.drInclude==='Include' },
          { key:'drRecoverySite',  label:'Recovery Site Name',           type:'text',   sample:'lax', showWhen:f=>f.drInclude==='Include' },
          { key:'drRecoveryVcFqdn',label:'Recovery vCenter FQDN',        type:'text',   sample:'lax-m01-vc01.lax.rainpole.io', showWhen:f=>f.drInclude==='Include' },
          { key:'drSsoType',       label:'SSO Domain Configuration',     type:'select', options:['Same SSO Domain','Different SSO Domain'], sample:'Same SSO Domain', showWhen:f=>f.drInclude==='Include' },
          { key:'drArchitecture',  label:'Architecture',                 type:'select', options:['Standard','Consolidated'], sample:'Standard', showWhen:f=>f.drInclude==='Include' },
        ]
      },
    ]
  },

  // ─── CYBER RECOVERY ───
  {
    id:'cyber-recovery', title:'Cyber Recovery', icon:'🔐', group:'recovery',
    subtitle:'EDR agent deployment for carbon black or CrowdStrike',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'EDR Agent Configuration',
        fields:[
          { key:'edrInclude',      label:'Include Cyber Recovery',      type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'edrProduct',      label:'EDR Product',                 type:'select', options:['Carbon Black','CrowdStrike'], sample:'Carbon Black', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrServerFqdn',   label:'EDR Server FQDN/IP',          type:'text',   sample:'cb-server.rainpole.io', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrApiKey',       label:'EDR API Key',                 type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrAgentVersion', label:'Agent Version',               type:'text',   sample:'3.9.1.5', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrGroupName',    label:'Sensor Group / Policy Name',  type:'text',   sample:'VCF-Hosts-Policy', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrProxyHost',    label:'EDR Proxy Host (optional)',   type:'text',   sample:'', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrInstallerPkg', label:'Installer Package Name',      type:'select', optionsFn:f=>f.edrProduct==='CrowdStrike'?['crowdstrike-installer']:['carbon-black-installer'], sample:'carbon-black-installer', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrIpAssign',     label:'IP Assignment',               type:'select', options:['Static','DHCP'], sample:'Static', showWhen:f=>f.edrInclude==='Include' },
          { key:'edrSensorIp',     label:'Sensor Server IP (Static)',   type:'ip',     sample:'', showWhen:f=>f.edrInclude==='Include'&&f.edrIpAssign==='Static' },
          { key:'edrSubnetMask',   label:'Subnet Mask',                 type:'select', optionsFn:()=>SUBNET_MASKS, sample:'255.255.255.0', showWhen:f=>f.edrInclude==='Include'&&f.edrIpAssign==='Static' },
          { key:'edrGateway',      label:'Gateway',                     type:'ip',     sample:'', showWhen:f=>f.edrInclude==='Include'&&f.edrIpAssign==='Static' },
        ]
      },
    ]
  },

  // ─── RANSOMWARE RECOVERY (ON-PREMISES) ───
  {
    id:'ransomware-onprem', title:'On-Premises Ransomware Recovery', icon:'🦠', group:'recovery',
    subtitle:'VMware Ransomware Recovery — on-premises configuration',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Recovery Configuration',
        fields:[
          { key:'rwrOnpremInclude',   label:'Include On-Prem Ransomware Recovery', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'rwrMgmtVcFqdn',    label:'Management vCenter FQDN',              type:'text',   sample:'sfo-m01-vc01.sfo.rainpole.io', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrCluster',        label:'Cluster',                              type:'text',   sample:'sfo-m01-cl01', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrVmName',         label:'Recovery Appliance VM Name',           type:'text',   sample:'sfo-w01-vlr01', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrDatastore',      label:'Datastore',                            type:'text',   sample:'sfo-m01-cl01-ds-vsan01', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrNetwork',        label:'VM Network',                           type:'text',   sample:'sfo-m01-cl01-vds01-mgmt', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrIp',             label:'Appliance IP',                         type:'ip',     sample:'10.11.10.55', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrSubnetMask',     label:'Subnet Mask',                          type:'select', optionsFn:()=>SUBNET_MASKS, sample:'255.255.255.0', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrGateway',        label:'Gateway',                              type:'ip',     sample:'10.11.10.1', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrBackupSchedule', label:'Backup Schedule',                      type:'select', options:['Hourly','Every 4 Hours','Every 6 Hours','Daily'], sample:'Every 4 Hours', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrRetentionDays',  label:'Retention Period (days)',               type:'number', sample:'30', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrProtectedVms',   label:'Protected VM Count (estimate)',         type:'number', sample:'50', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrSnapshotCount',  label:'Snapshots per VM',                     type:'number', sample:'24', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrAdminPw',        label:'Recovery Appliance Admin Password',    type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrNtp1',           label:'NTP Server 1',                         type:'text',     sample:'ntp.sfo.rainpole.io', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrNtp2',           label:'NTP Server 2',                         type:'text',     sample:'', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrDns1',           label:'DNS Server 1',                         type:'ip',       sample:'10.11.0.2', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrDns2',           label:'DNS Server 2',                         type:'ip',       sample:'', showWhen:f=>f.rwrOnpremInclude==='Include' },
          { key:'rwrDomainName',     label:'Domain Name',                          type:'text',     sample:'rainpole.io', showWhen:f=>f.rwrOnpremInclude==='Include' },
        ]
      },
    ]
  },

  // ─── RANSOMWARE RECOVERY (CLOUD-BASED) ───
  {
    id:'ransomware-cloud', title:'Cloud-Based Ransomware Recovery', icon:'☁️', group:'recovery',
    subtitle:'VMware Cloud Disaster Recovery (DRaaS) — AWS cloud configuration',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Cloud-Based DR Configuration',
        fields:[
          { key:'cbrInclude',     label:'Include Cloud-Based Ransomware Recovery', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'cbrAwsRegion',   label:'AWS Region',                              type:'select',
            options:['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-southeast-1','ap-northeast-1','ap-south-1','ca-central-1'],
            sample:'us-east-1', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrArchitecture',label:'Architecture',                            type:'select', options:['Standard','Consolidated'], sample:'Standard', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrConnector1Fqdn',label:'DRaaS Connector 1 FQDN',              type:'text',   sample:'sfo-cbr-cdp01a.sfo.rainpole.io', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrConnector1Ip',  label:'DRaaS Connector 1 IP',                type:'ip',     sample:'10.11.10.44', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrConnector2Fqdn',label:'DRaaS Connector 2 FQDN',              type:'text',   sample:'sfo-cbr-cdp01b.sfo.rainpole.io', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrConnector2Ip',  label:'DRaaS Connector 2 IP',                type:'ip',     sample:'10.11.10.45', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrOrgId',         label:'Cloud DR Organization ID',             type:'text',   sample:'', showWhen:f=>f.cbrInclude==='Include' },
          { key:'cbrApiToken',      label:'Cloud DR API Token',                   type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.cbrInclude==='Include' },
        ]
      },
    ]
  },

  // ─── CROSS CLOUD MOBILITY (HCX) ───
  {
    id:'cross-cloud', title:'Cross Cloud Mobility (HCX)', icon:'☁️', group:'cloudai',
    subtitle:'VMware HCX — workload mobility to VMware Cloud on AWS',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'HCX Configuration',
        fields:[
          { key:'ccmInclude',     label:'Include Cross Cloud Mobility',  type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'ccmAwsRegion',   label:'AWS Region',                    type:'select',
            options:['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-southeast-1','ap-northeast-1'],
            sample:'us-east-1', showWhen:f=>f.ccmInclude==='Include' },
          { key:'ccmArchitecture',label:'Architecture',                  type:'select', options:['Standard','Consolidated'], sample:'Standard', showWhen:f=>f.ccmInclude==='Include' },
          { key:'ccmHcxFqdn',     label:'HCX Manager FQDN',             type:'text',   sample:'sfo-ccm-hcx01.sfo.rainpole.io', showWhen:f=>f.ccmInclude==='Include' },
          { key:'ccmHcxIp',       label:'HCX Manager IP',               type:'ip',     sample:'10.11.10.46', showWhen:f=>f.ccmInclude==='Include' },
          { key:'ccmHcxAdminPw',  label:'HCX Admin Password',           type:'password', sample:'AUTO-GENERATED', showWhen:f=>f.ccmInclude==='Include' },
          { key:'hcxLicenseKey',  label:'HCX License Key',              type:'text', required:true, sample:'', showWhen:f=>f.ccmInclude==='Include' },
        ]
      },
      {
        title:'HCX Network Profiles',
        showWhen: f => f.ccmInclude==='Include',
        fields:[
          { key:'ccmMgmtNetProfile',     label:'Management Network Profile',  type:'text', sample:'sfo-m01-cl01-dvs01-mgmt' },
          { key:'ccmUplinkNetProfile',   label:'Uplink Network Profile',      type:'text', sample:'sfo-m01-cl01-dvs01-uplink' },
          { key:'ccmUplinkIpStart',      label:'Uplink IP Range Start',       type:'ip',   sample:'10.11.10.200' },
          { key:'ccmUplinkIpEnd',        label:'Uplink IP Range End',         type:'ip',   sample:'10.11.10.210' },
          { key:'ccmVmotionNetProfile',  label:'vMotion Network Profile',     type:'text', sample:'sfo-m01-cl01-dvs01-vmotion' },
        ]
      },
    ]
  },

  // ─── PRIVATE AI READY INFRASTRUCTURE ───
  {
    id:'private-ai', title:'Private AI Ready Infrastructure', icon:'🤖', group:'cloudai',
    subtitle:'GPU workloads — NVIDIA GPU Operator, vGPU, Private AI Foundation',
    showWhen: f => f.deploymentType==='VMware Cloud Foundation',
    sections:[
      {
        title:'Private AI Configuration',
        fields:[
          { key:'aiInclude',          label:'Include Private AI Ready Infrastructure', type:'toggle', options:['Include','Exclude'], sample:'Exclude' },
          { key:'aiArchitecture',     label:'Architecture',                            type:'select', options:['Standard','Consolidated'], sample:'Standard', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiLicenseKey',       label:'Private AI License Key',                 type:'text',   sample:'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuModel',         label:'GPU Model',                              type:'text',   sample:'NVIDIA A100 80GB', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuCountPerHost',  label:'GPUs per Host',                          type:'number', sample:'4', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiVgpuProfile',      label:'vGPU Profile',                           type:'text',   sample:'A100-40C', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuDriverVersion', label:'GPU Driver Version',                     type:'text',   sample:'530.30.02', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiNvidiaLicenseServer', label:'NVIDIA License Server FQDN',          type:'text',   sample:'nls.rainpole.io', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiNvidiaLicenseType',   label:'NVIDIA License Type',                 type:'select', options:['vGPU','GPU Pass-through','MIG'], sample:'vGPU', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuVmClass',       label:'GPU VM Class Size',                      type:'select', options:['guaranteed-small','guaranteed-medium','guaranteed-large'], sample:'guaranteed-medium', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuNamespace',     label:'GPU Operator Namespace',                 type:'text',   sample:'vmware-system-gpu', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiNetNamespace',     label:'GPU Network Operator Namespace',         type:'text',   sample:'vmware-system-gpu-net', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiK8sClusterName',   label:'Kubernetes Cluster Name',               type:'text',   sample:'sfo-w01-tkg01', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiSupervisorNs',     label:'Supervisor Namespace',                  type:'text',   sample:'ai-workloads', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiStorageClass',     label:'Storage Class',                         type:'text',   sample:'wcpglobal-storage-profile', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiServiceCidr',      label:'K8s Services CIDR',                     type:'cidr',   sample:'198.51.100.0/12', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiPodCidr',          label:'K8s Pods CIDR',                         type:'cidr',   sample:'192.0.2.0/16', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuVcpu',          label:'GPU VM Class vCPU',                     type:'number', sample:'16', showWhen:f=>f.aiInclude==='Include' },
          { key:'aiGpuRam',           label:'GPU VM Class RAM (GB)',                 type:'number', sample:'64', showWhen:f=>f.aiInclude==='Include' },
        ]
      },
    ]
  },

  // ─── PORTS & PROTOCOLS ───
  { id:'ports', title:'Ports & Protocols', icon:'🔌', group:'reference',
    subtitle:'Port matrix for VCF 9.1 components — source: Broadcom Ports and Protocols Tool', sections:[] },
]
