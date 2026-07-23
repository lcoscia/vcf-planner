// Regression oracle for the extracted core: replays the three Excel-verified
// scenarios from tools/sizing_scenarios.md and asserts computeSizing() matches.
// Run: node --test  (from the mcp/ dir, or `node --test mcp/test/scenarios.test.js`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeSizing, calcRawCPU, calcRawRAM, calcRawDisk,
  calcHosts, calcTotalDisk, calcDiskPerHost,
} from '../../core/sizing.js'

// Baseline sizing state mirroring the index.html defaults; each scenario overrides.
function baseSizing() {
  return {
    hostCores: 36, hostRAM: 512, cpuOverSub: '1',
    storageType: 'vSAN-ESA', growthPct: 10, opsReservePct: 30,
    clusterModel: 'High Availability (Three-Node)',
    instanceProfileSize: 'Medium', vcfInstanceModel: 'First Instance',
    logReplicaCount: 1, wldCount: 0,
    components: {
      sddc_manager: false, vcenter: false, nsx_manager: false, nsx_edge: false,
      vcf_operations: false, vcf_logs: false, avi_lb: false, vcfa: false, ssp: false,
      vcf_svc_runtime: false, cloud_proxy: false, license_server: false,
      vcf_ops_networks: false, vcf_ops_networks_collector: false, realtime_metrics: false,
      identity_broker: false, software_depot: false, vrms: false, srm: false,
      hvm: false, cloud_ransomware: false, hcx_connector: false,
    },
    compSizes: {
      vcenter: 'Medium', vcenterStorage: 'Large', wldVcSize: 'Small',
      nsx_manager: 'Medium', nsx_manager_model: 'Mandatory - HA Cluster',
      nsx_edge: 'NSX Edge Medium', vcf_operations: 'Small', vcf_logs: 'Small',
      avi_lb: 'Small', vcfa: 'Small', cloud_proxy: 'Medium', ssp: 'Medium',
      identity_broker: 'Small', vcf_ops_networks: 'Small', vcf_ops_networks_collector: 'Small',
      vrms: 'Light', srm: 'Light',
    },
  }
}

function assertScenario(s, expected) {
  assert.equal(calcRawCPU(s), expected.rawCPU, 'rawCPU')
  assert.equal(calcRawRAM(s), expected.rawRAM, 'rawRAM')
  assert.equal(calcRawDisk(s), expected.rawDisk, 'rawDisk')
  assert.equal(calcHosts(s), expected.hosts, 'hosts')
  assert.equal(calcTotalDisk(s), expected.totalDisk, 'totalDisk')
  assert.equal(calcDiskPerHost(s), expected.diskPerHost, 'diskPerHost')
  // computeSizing() must agree with the individual calculators
  const c = computeSizing(s)
  assert.equal(c.hostCount, expected.hosts, 'computeSizing.hostCount')
  assert.equal(c.totalDisk, expected.totalDisk, 'computeSizing.totalDisk')
  assert.equal(c.diskPerHost, expected.diskPerHost, 'computeSizing.diskPerHost')
}

test('Scenario 1 — Management Domain HA vSAN-ESA standard (Excel default)', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Medium' })
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: true, vcf_svc_runtime: true })
  assertScenario(s, { rawCPU: 114, rawRAM: 292, rawDisk: 7072, hosts: 4, totalDisk: 15796, diskPerHost: 5266 })
})

test('Scenario 2 — Simple deployment (1-node, minimal, vSAN-OSA)', () => {
  const s = baseSizing()
  Object.assign(s, {
    hostCores: 36, hostRAM: 512, storageType: 'vSAN-OSA',
    clusterModel: 'Simple', instanceProfileSize: 'Small',
  })
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: true, vcf_svc_runtime: true })
  Object.assign(s.compSizes, { vcenter: 'Small', vcenterStorage: 'Default', nsx_manager: 'Small', nsx_manager_model: 'Mandatory - Single Node' })
  assertScenario(s, { rawCPU: 52, rawRAM: 135, rawDisk: 4908, hosts: 3, totalDisk: 14424, diskPerHost: 7212 })
})

test('Scenario 3 — Fleet/VCFMS + additional components (HA vSAN-ESA Large)', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Large', logReplicaCount: 3 })
  Object.assign(s.components, {
    sddc_manager: true, vcenter: true, nsx_manager: true, vcf_operations: true,
    vcf_logs: true, ssp: true, cloud_proxy: true, vcf_svc_runtime: true,
  })
  Object.assign(s.compSizes, { vcf_operations: 'Medium', vcf_logs: 'Medium', ssp: 'Medium', cloud_proxy: 'Medium' })
  assertScenario(s, { rawCPU: 360, rawRAM: 1020, rawDisk: 14943, hosts: 4, totalDisk: 34242, diskPerHost: 11414 })
})

test('Scenario 4 — Workload Domains add CPU/RAM/disk and appear in the breakdown', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Medium', wldCount: 2 })
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: true, vcf_svc_runtime: true })
  Object.assign(s.compSizes, { wldVcSize: 'Medium' })
  // 2× WLD domains, each contributing wld_vcenter.Medium {vcpu:8,ram:30,disk:933} +
  // 3× nsx_manager.Small {vcpu:4,ram:16,disk:300} = {vcpu:20,ram:78,disk:1833} per domain
  // -> +40 vcpu, +156 ram, +3666 disk on top of sddc_manager+vcenter+nsx_manager+vcf_svc_runtime.
  assertScenario(s, { rawCPU: 154, rawRAM: 448, rawDisk: 11313, hosts: 4, totalDisk: 25229, diskPerHost: 8410 })

  const wldRow = computeSizing(s).breakdown.find(r => r.name.includes('Workload Domain'))
  assert.ok(wldRow, 'breakdown includes a Workload Domain row')
  assert.equal(wldRow.excluded, false, 'Workload Domain row is not excluded when wldCount > 0')
  assert.deepEqual({ vcpu: wldRow.vcpu, ram: wldRow.ram, disk: wldRow.disk }, { vcpu: 40, ram: 156, disk: 3666 })

  const s0 = baseSizing()
  Object.assign(s0.components, { sddc_manager: true })
  const wldRowExcluded = computeSizing(s0).breakdown.find(r => r.name.includes('Workload Domain'))
  assert.equal(wldRowExcluded.excluded, true, 'Workload Domain row is excluded when wldCount is 0')
})
