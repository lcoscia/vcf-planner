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
      wldNsxModel: 'Dedicated - HA Cluster', wldNsxSize: 'Large',
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

test('Scenario 4 — Workload Domain vCenter + NSX Manager (default Dedicated - HA Cluster), independent of the Management Domain NSX toggle', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Medium', wldCount: 2 })
  // Management Domain's own NSX Manager toggle is OFF — the WLD NSX contribution must not depend on it.
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: false, vcf_svc_runtime: true })
  Object.assign(s.compSizes, { wldVcSize: 'Medium' })
  assertScenario(s, { rawCPU: 184, rawRAM: 568, rawDisk: 10413, hosts: 4, totalDisk: 23556, diskPerHost: 7852 })

  const [vcRow, nsxRow] = computeSizing(s).breakdown.filter(r => r.name.includes('Workload Domain'))
  assert.equal(vcRow.excluded, false, 'WLD vCenter row is not excluded when wldCount > 0')
  assert.deepEqual({ vcpu: vcRow.vcpu, ram: vcRow.ram, disk: vcRow.disk }, { vcpu: 16, ram: 60, disk: 1866 })
  assert.equal(nsxRow.excluded, false, 'WLD NSX Manager row is not excluded for Dedicated models')
  assert.deepEqual({ vcpu: nsxRow.vcpu, ram: nsxRow.ram, disk: nsxRow.disk }, { vcpu: 72, ram: 288, disk: 1800 })
})

test('Scenario 5 — Workload Domain "Shared" NSX model contributes zero NSX cost', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Medium', wldCount: 2 })
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: true, vcf_svc_runtime: true })
  Object.assign(s.compSizes, { wldVcSize: 'Medium', wldNsxModel: 'Shared (use Management NSX)' })
  assertScenario(s, { rawCPU: 130, rawRAM: 352, rawDisk: 9513, hosts: 4, totalDisk: 21162, diskPerHost: 7054 })

  const [vcRow, nsxRow] = computeSizing(s).breakdown.filter(r => r.name.includes('Workload Domain'))
  assert.equal(vcRow.excluded, false, 'WLD vCenter still counts when NSX is Shared')
  assert.equal(nsxRow.excluded, true, 'WLD NSX Manager row is excluded when Shared')
  assert.deepEqual({ vcpu: nsxRow.vcpu, ram: nsxRow.ram, disk: nsxRow.disk }, { vcpu: 0, ram: 0, disk: 0 })
})

test('Scenario 6 — Workload Domain "Dedicated - Single Node" NSX model uses 1 node, not 3', () => {
  const s = baseSizing()
  Object.assign(s, { hostCores: 128, hostRAM: 1024, storageType: 'vSAN-ESA', instanceProfileSize: 'Medium', wldCount: 2 })
  Object.assign(s.components, { sddc_manager: true, vcenter: true, nsx_manager: false, vcf_svc_runtime: true })
  Object.assign(s.compSizes, { wldVcSize: 'Medium', wldNsxModel: 'Dedicated - Single Node', wldNsxSize: 'Medium' })
  assertScenario(s, { rawCPU: 124, rawRAM: 328, rawDisk: 9213, hosts: 4, totalDisk: 20467, diskPerHost: 6823 })

  const [, nsxRow] = computeSizing(s).breakdown.filter(r => r.name.includes('Workload Domain'))
  assert.equal(nsxRow.name, 'Workload Domain NSX Manager ×2 (Dedicated - Single Node, Medium)')
  assert.deepEqual({ vcpu: nsxRow.vcpu, ram: nsxRow.ram, disk: nsxRow.disk }, { vcpu: 12, ram: 48, disk: 600 })
})

test('Scenario 7 — wldCount 0 excludes both Workload Domain breakdown rows', () => {
  const s0 = baseSizing()
  Object.assign(s0.components, { sddc_manager: true })
  const rows = computeSizing(s0).breakdown.filter(r => r.name.includes('Workload Domain'))
  assert.equal(rows.length, 2, 'both WLD vCenter and WLD NSX Manager rows are present (just excluded)')
  assert.ok(rows.every(r => r.excluded), 'both Workload Domain rows are excluded when wldCount is 0')
})
