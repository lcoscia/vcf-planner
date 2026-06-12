# Management Domain Sizing — verification scenarios

These three scenarios exercise the disk-sizing chain (`calcRawCPU/RAM/Disk`,
`calcHosts`, `calcTotalDisk`, `calcDiskPerHost`, `vcfmsAggregate`) in
`index.html` and were verified against the Excel workbook
`vcf-9.1-planning-and-preparation-workbook-updated.xlsx`
(`Management Domain Sizing` rows R8/R15-R21 and `Static Reference Tables`
Lookup Tables).

Replay them in the browser (Management Domain Sizing page) by setting the
listed Sizing inputs and component selections, then compare the displayed
"Required Hosts", "Total Storage Required" and "Disk per host" values
against the expected results below.

To re-derive these numbers programmatically, see
`python3 tools/check_lt_constants.py` (which parses the same `const LT` used
here) — the formula chain itself (R15-R21) is implemented in
`calcTotalDisk()`/`calcDiskPerHost()`/`calcHosts()` in `index.html`.

---

## Scenario 1 — Management Domain HA vSAN-ESA standard (Excel default)

This matches the Excel workbook's own default state for the Management
Domain Sizing tab.

**Sizing inputs:**
- `hostCores`: 128, `hostRAM`: 1024, `cpuOverSub`: 1
- `storageType`: `vSAN-ESA`
- `opsReservePct`: 30, `growthPct`: 10
- `clusterModel`: `High Availability (Three-Node)`
- `instanceProfileSize`: `Medium`
- `vcfInstanceModel`: `First Instance`
- `wldCount`: 0

**Components enabled:**
- SDDC Manager
- vCenter Server — Medium, storage tier Large (vcenter_disk_tiers.Medium.Large = 1658)
- NSX Manager — Medium, model "Mandatory - HA Cluster" (×3)
- VCF Services Runtime (Control + Worker) — via `vcfInstanceModel`/`instanceProfileSize`/`clusterModel` above

All other components excluded.

**Expected results (= Excel R8/R15-R21):**
| Metric | Value |
|---|---|
| `calcRawCPU()` (R33 vCPU total)  | 114 |
| `calcRawRAM()` (R16 / R33 RAM total) | 292 |
| `calcRawDisk()` (R15) | 7072 |
| `calcHosts()` (R8) | 4 |
| `calcTotalDisk()` (R20) | 15796 |
| `calcDiskPerHost()` (R21) | 5266 |

**Disk chain detail:**
- R17 (Interim Total) = 7072 + 292 = 7364
- R18 (Redundancy, ×1.5 for vSAN-ESA) = ROUNDUP(7364×1.5) = 11046
- R19 (Ops Reserve, ×1.3) = ROUNDUP(11046×1.3) = 14360
- R20 (Growth, ×1.1) = ROUNDUP(14360×1.1) = 15796
- R21 = ROUNDUP(15796 / (4-1)) = 5266

`vcfmsAggregate()` for this scenario: `ctrlNodes=3`, `workerNodes=3`,
`{vcpu:84, ram:174, disk:3600}` — the disk figure includes the
`vcfms_extra_disk['First Instance']['Medium'] = 3000` extra allotment from
the Excel M21 formula (3×100 control + 3×100 worker + 3000 = 3600).

---

## Scenario 2 — Simple deployment (1-node, minimal)

**Sizing inputs:**
- `hostCores`: 36, `hostRAM`: 512, `cpuOverSub`: 1
- `storageType`: `vSAN-OSA`
- `opsReservePct`: 30, `growthPct`: 10
- `clusterModel`: `Simple` (forces `instanceProfileSize` = `Small`)
- `vcfInstanceModel`: `First Instance`
- `wldCount`: 0

**Components enabled:**
- SDDC Manager
- vCenter Server — Small, storage tier Default (vcenter_disk_tiers.Small.Default = 694)
- NSX Manager — Small, model "Mandatory - Single Node" (×1)
- VCF Services Runtime (Control + Worker) — Simple/Small/First Instance

All other components excluded.

**Expected results:**
| Metric | Value |
|---|---|
| `calcRawCPU()` | 52 |
| `calcRawRAM()` | 135 |
| `calcRawDisk()` | 4908 |
| `calcHosts()` | 2 |
| `calcTotalDisk()` | 14424 |
| `calcDiskPerHost()` | 14424 |

**Notes:**
- `calcHosts()`: `byCpu = ceil(52/36) = 2`, `byRam = ceil(135/512)+1 = 2`,
  `min = 1` (Simple) → `hosts = max(1,2,2) = 2`. Since `hosts > 1`, the
  divisor is `hosts-1 = 1` (the `hosts<=1 → divisor=1` special case only
  applies to a true 1-host result).
- `vcfmsAggregate()` for Simple/Small/First Instance: `ctrlNodes=1`
  (`vcfms_control_nodes.Simple`), `workerNodes=3` (Simple deployment model
  forces 3 worker nodes per the Excel J21 formula, regardless of size),
  `{vcpu:40, ram:82, disk:3000}` (disk = 1×100 + 3×100 +
  `vcfms_extra_disk['First Instance']['Small']` 2600 = 3000).
- Disk chain (vSAN-OSA → overhead ×2.0): R17=5043, R18=ROUNDUP(5043×2)=10086,
  R19=ROUNDUP(10086×1.3)=13112, R20=ROUNDUP(13112×1.1)=14424.

---

## Scenario 3 — Fleet/VCFMS + additional components

**Sizing inputs:**
- `hostCores`: 128, `hostRAM`: 1024, `cpuOverSub`: 1
- `storageType`: `vSAN-ESA`
- `opsReservePct`: 30, `growthPct`: 10
- `clusterModel`: `High Availability (Three-Node)`
- `instanceProfileSize`: `Large`
- `vcfInstanceModel`: `First Instance`
- `wldCount`: 0

**Components enabled:**
- SDDC Manager
- vCenter Server — Medium, storage tier Large (1658)
- NSX Manager — Medium, "Mandatory - HA Cluster" (×3)
- VCF Operations — Medium
- Log Management (vcf_logs) — Medium
- vDefend SSP — Medium (+ "vDefend/AVI Licensing Hub" `ssp_license` auto-added
  since `ssp !== 'Excluded'`)
- Cloud Proxy — Medium
- VCF Services Runtime (Control + Worker) — HA/Large/First Instance

All other components excluded.

**Expected results:**
| Metric | Value |
|---|---|
| `calcRawCPU()` | 296 |
| `calcRawRAM()` | 908 |
| `calcRawDisk()` | 14218 |
| `calcHosts()` | 4 |
| `calcTotalDisk()` | 32446 |
| `calcDiskPerHost()` | 10816 |

**Notes:**
- `vcfmsAggregate()` for HA/Large/First Instance: `ctrlNodes=3`,
  `workerNodes=4` (`vcfms_worker_nodes.Large`), `{vcpu:120, ram:234,
  disk:4402}` (disk = 3×100 + 4×100 +
  `vcfms_extra_disk['First Instance']['Large']` 3702 = 4402).
- `calcRawDisk()` breakdown: SDDC Manager 914 + vCenter 1658 + NSX Manager
  ×3 900 + VCF Operations 274 + Log Management 1000 + SSP 4096 +
  SSP License 710 + Cloud Proxy 264 + VCF Services Runtime 4402 = 14218.
- Disk chain: R17 = 14218+908 = 15126, R18 = ROUNDUP(15126×1.5) = 22689,
  R19 = ROUNDUP(22689×1.3) = 29496, R20 = ROUNDUP(29496×1.1) = 32446,
  R21 = ROUNDUP(32446/(4-1)) = 10816.
