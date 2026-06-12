# VCF 9.1 Planning & Preparation Workbook — Web Edition

A browser-only, single-file interactive replacement for Broadcom's official **VMware Cloud Foundation 9.1 Planning & Preparation Workbook** (27-sheet Excel). Open `index.html` directly — no server, no build step, no dependencies to install.

---

## Quick Start

```bash
# Just open the file in any modern browser
open index.html
```

Or double-click `index.html` in Finder / Explorer.

---

## Features

| Category | Details |
|---|---|
| **Coverage** | 19 pages · 600+ fields across all 27 original sheets |
| **Deployment modes** | VCF and VVF · New Fleet, Additional Instance, Workload Domain, Additional Cluster |
| **Sizing calculator** | Live host count + disk-per-host formulas aligned with the Excel workbook (lookup tables and formula chain re-verified 2026-06-12, see `tools/check_lt_constants.py` / `tools/sizing_scenarios.md`) · Advanced Sizer (vCenter Storage Size tier, NSX Manager Model ×1/×3, Cloud Proxy Small/Medium/Large) · WLD vCenter sizing (Shared/Dedicated with size & storage tier) · Instance Profile Size coupled to Cluster Model (Simple → forced Small), VCF Services Instance Model (First/Additional Instance) and Log Management replica count (per-replica node & disk scaling) · VCF Management Services, Fleet Components & Site Protection/DR components included in component inclusions |
| **Persistence** | Auto-save to `localStorage` · Export/Import JSON |
| **Export** | JSON · Markdown As-Built · CSV IPAM table · VCF Installer `SddcSpec` JSON |
| **Validation** | VLAN conflict detection · IP conflict detection · CIDR overlap detection · FQDN format check · Constrained dropdowns derived from the official Excel data-validation lists (appliance sizes, vSAN FTT, storage types, subnet masks /32–/0, …) |
| **Help bubbles** | Inline "ⓘ" tooltips on key sizing fields linking out to the official Broadcom VCF 9 design documentation |
| **As-Built** | VLAN topology table · DNS pre-flight checklist · Completion dashboard |
| **UX** | Dark mode · Keyboard nav (`Alt+→` / `Alt+←`) · Expand/Collapse all · Jump to first missing · Auto-fill host IPs · Copy section |

---

## Pages Covered

| # | Page | Description |
|---|---|---|
| 01 | VCF & VVF Planning | Master selectors — deployment type, mode, version |
| 02 | Prerequisite Checklist | Hardware, network, software, certificate requirements |
| 03 | Management Domain Sizing | Live sizing calculator (CPU / RAM / disk per host) |
| 04 | Deploy Management Domain | SDDC Manager, vCenter, NSX, hosts, networking |
| 05 | Configure Management Domain | NSX Federation, AVI LB, vSphere Supervisor, Cloud Proxy |
| 06 | Fleet Management Day-N | VCF Operations, Automation, Logs, VCFA, vDefend SSP · expanded IP/FQDN coverage for the VCF Operations cluster (Primary/Replica/Data/Load Balancer nodes), VCF Automation IP pool, and VCF Operations for Networks Platform/Collector nodes |
| 07 | Active Directory Inputs | AD groups, service accounts, LDAP settings |
| 08 | Deploy Workload Domain | WLD hosts, NSX, storage, networking · WLD vCenter sizing (Shared/Dedicated, size, storage tier) |
| 09 | Configure Workload Domain | WLD-level configuration |
| 10 | Deploy Additional Cluster | Extra vSphere cluster deployment |
| 11 | Additional Racks | Multi-Rack L3 topology (up to 8 racks) |
| 12 | Site Protection & DR | VMware Live Recovery / SRM |
| 13 | Cyber Recovery | Isolated recovery environment |
| 14 | Ransomware Recovery (On-Prem) | On-premises ransomware protection |
| 15 | Ransomware Recovery (Cloud) | Cloud-based DRaaS connectors |
| 16 | Cross Cloud Mobility (HCX) | HCX deployment and network profiles |
| 17 | Private AI Ready Infrastructure | GPU operator, vGPU, TKG, K8s CIDRs |
| 18 | Ports & Protocols | Searchable/filterable port matrix (1083 entries, 19 components) — source: Broadcom Ports and Protocols Tool |
| 19 | As-Built / Summary | Full recap, validation panels, export buttons |

---

## Architecture

```
index.html                  ← single file, ~5700 lines
├── <head>
│   ├── Alpine.js 3.14.1    (CDN, defer)
│   ├── @alpinejs/collapse  (CDN, loaded before Alpine core)
│   └── Tailwind CSS CDN    (play CDN, darkMode: 'class')
├── <body>
│   ├── Topbar              fixed header — nav + toolbar buttons
│   ├── Sidebar             nav groups + per-page progress bars
│   └── Main content        page router (x-show per page)
└── <script>
    ├── LT                  Lookup tables (vCenter/NSX/AVI/VCFMS/etc sizes — derived from the 'Static Reference Tables' sheet, verified by tools/check_lt_constants.py)
    ├── SUBNET_MASKS        Canonical 33-entry subnet mask list, /32-/0 (from 'Static Reference Tables')
    ├── PREREQ_DATA         Prerequisite checklist rows
    ├── PORTS_DATA          Ports & Protocols matrix (1083 rows — source: ports.broadcom.com)
    ├── makeNetFields()     Helper — network segment field group
    ├── makeHostFields()    Helper — N×(FQDN+IP) host fields
    ├── makeRackFields()    Helper — multi-rack section
    ├── ALL_PAGES[]         Form schema — 18 form pages (Welcome & As-Built are rendered separately)
    ├── NAV_GROUPS[]        Sidebar navigation structure
    └── vcfPlanner()        Alpine.js component (state + methods)
```

### Key patterns

- **`ALL_PAGES`** — Array of `{ id, title, sections[] }`. Each section has `fields[]` with `type`, `showWhen`, `required`, `optionsFn`, etc.
- **`showWhen: f => ...`** — Conditional visibility at page / section / field level, driven by `form.*` values.
- **`optionsFn: f => [...]`** — Dynamic dropdown options based on current form state (e.g., DVS profile options differ for VCF vs VVF; EDR installer package name depends on the chosen EDR product).
- **`docLink` / `docLabel`** — Optional on any field; renders an "ⓘ" help bubble next to the label that links to the official Broadcom VCF design documentation for that choice (see e.g. `vcMgmtSize`, `nsxEdgeSize`, `vsanFtt`).
- **`calcHosts()`** — `MAX(min, ROUNDUP(rawCPU/overSub/hostCores), ROUNDUP(rawRAM/hostRAM)+1)` with storage-aware minimums (HA=4, vSAN=3 — the vSAN quorum floor applies even under the Simple deployment model, non-vSAN=2), using the un-reserved raw CPU/RAM totals (aligned with the Excel `Management Domain Sizing` R8 formula).
- **Disk-sizing chain** (`calcTotalDisk()` / `calcDiskPerHost()`) — follows the Excel `Management Domain Sizing` R15-R21 order of operations: Virtual Machine Capacity (`calcRawDisk()`) + Swap File Requirements (`calcRawRAM()`) → FTT1 redundancy (×1.5 for vSAN-ESA, ×2.0 for vSAN-OSA) → host-rebuild/ops-reserve (× `1 + opsReservePct`) → estimated growth (× `1 + growthPct`), then divided across `hosts - 1` for the per-host figure. FC and NFSv3 skip both the redundancy multiplier and the ops reserve — growth is applied directly to the interim total, as in the Excel R20 branch.
- **`roundUp()`** — a small `Math.ceil(x - 1e-9)` helper used everywhere the Excel uses `ROUNDUP()`, to avoid floating-point artifacts (e.g. `14360 * 1.1 === 15796.000000000002` in JS) pushing an exact integer result up by one.
- **Persistence key** — `localStorage` key `vcf-planner-v1` stores `{ form, sizing, currentPage, openGroups, openSections }`.

### Sizing calculator — web-only additions

A few details in the sizing calculator are intentional web-side additions or simplifications with no direct 1:1 equivalent in the Excel workbook:

- **`calcTotalCPU()` / `calcTotalRAM()`** ("Total vCPU/RAM (with reserve)") apply the operations-reserve percentage to CPU and RAM for display purposes. The Excel workbook only applies the operations-reserve percentage to the disk-sizing chain (R19) — it has no equivalent "+reserve" CPU/RAM total. Treat these two figures as supplementary web-only metrics.
- **`vcfInstanceModel`** ("VCF Services Instance Model" — First Instance / Additional Instance) is a new selector added to drive the VCFMS worker-node-count and extra-disk formulas (Excel `Static Reference Tables` J21/M21), aligned with the Excel's "Deployment Size" × "Instance Model" lookup.
- **Component toggles are not gated on `vcfInstanceModel`** — in the Excel, License Server only counts for a First Instance, while Identity Broker and Software Depot only count for an Additional Instance. The web calculator leaves all three freely toggleable (their labels carry the "(Additional Instance)" hint); the toggle expresses the user's intent directly.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + →` | Navigate to next visible page |
| `Alt + ←` | Navigate to previous visible page |
| `Tab` | Focus skip-nav link (accessibility) |

---

## Toolbar Buttons

| Button | Action |
|---|---|
| ⬆ Import | Load a previously exported JSON file |
| ⬇ JSON | Export current form state as JSON |
| 📄 MD | Export As-Built report as Markdown |
| 📊 CSV | Export all IP/text fields as CSV (IPAM) |
| 🚀 JSON VCF Installer ready | Export a VCF Installer `SddcSpec` JSON (`POST /v1/sddcs` payload) |
| ⬆ JSON VCF Installer ready | Best-effort import of a VCF Installer `SddcSpec` JSON back into the form |
| 🌙 / ☀️ | Toggle dark / light mode |
| 🔌 Ports | Jump to the Ports & Protocols reference page |
| 🧪 DEMO | Fill all Management Domain fields with example data (4-node vSAN-ESA cluster + NSX Edge) — confirmation required |
| ↺ Reset | Clear all form data (with confirmation) |

---

## Privacy & Data Handling

This tool makes **zero network requests containing your data**. All processing happens client-side; the only network traffic is the one-time load of the Alpine.js / Tailwind CDN scripts on page load (none of which receive form data). Your configuration is saved only to your browser's `localStorage` (key `vcf-planner-v1`), which other websites cannot read due to the browser's same-origin policy.

The Alpine.js and `@alpinejs/collapse` scripts are loaded with **Subresource Integrity (SRI)** hashes (pinned to v3.14.1), so the browser refuses to run them if the CDN ever serves a modified file.

⚠️ **Password fields are stored in plaintext** in `localStorage` and are included unencrypted in **Export JSON** backups (root/SSO/SSH passwords, API keys/tokens) and, where applicable, in the **VCF Installer JSON** export (ESXi root and vCenter root passwords only). Treat exported `.json` files as sensitive credentials — don't commit them to public repos or share over unencrypted channels. Anyone with access to the same browser profile/device can also read this data via DevTools, as with any localStorage-based app.

---

## Development

The file is self-contained — edit it directly in any text editor. No npm, no build step.

To add a new field, add an entry to the relevant `sections[].fields[]` array in `ALL_PAGES`:

```javascript
{
  key: 'myNewField',          // unique camelCase key → stored in form.myNewField
  label: 'My Field Label',
  type: 'text',               // text | number | ip | cidr | select | toggle | password | textarea | readonly | calculated
  sample: 'example-value',    // shown in Sample column and used as placeholder
  required: true,             // marks field with * and shows orange if empty
  notes: 'Helpful tip',       // shown in Notes column
  showWhen: f => f.someKey === 'someValue',  // optional — hides field when false
  optionsFn: f => [...],      // for select: dynamic options based on form state
  docLink: 'https://techdocs.broadcom.com/...',  // optional — adds an "ⓘ" help bubble linking to official docs
  docLabel: 'Link text shown in the bubble',     // optional — defaults to "Ouvrir la documentation"
}
```

To add a new page, add an entry to `ALL_PAGES` and a corresponding item to `NAV_GROUPS`.

### Verification

The sizing calculator's lookup tables (`const LT`) and `SUBNET_MASKS` are checked against the official
`vcf-9.1-planning-and-preparation-workbook-updated.xlsx` workbook ("Static Reference Tables" sheet) by:

```bash
python3 tools/check_lt_constants.py
```

The workbook itself is gitignored (not redistributed with this repo) — place a copy next to `index.html`
to run the check. It prints a ✓/✗ report per component/tier and exits non-zero on any divergence.

`tools/sizing_scenarios.md` documents 3 end-to-end Management Domain Sizing scenarios (inputs +
expected "Required Hosts" / "Total Storage Required" / "Disk per Host" results, cross-checked against
the Excel's `Management Domain Sizing` sheet) for manually replaying in the browser after future changes
to the sizing calculator.

---

## Stack

| Library | Version | Purpose |
|---|---|---|
| [Alpine.js](https://alpinejs.dev) | 3.14.1 | Reactivity, templating, state |
| [@alpinejs/collapse](https://alpinejs.dev/plugins/collapse) | 3.x | Animated accordion sections |
| [Tailwind CSS](https://tailwindcss.com) | CDN (play) | Utility-first styling, dark mode |

---

## Changelog

- **v1.1.2** (2026-06-12) — Audit fixes (sizing formulas & validation lists): a multi-pass audit against the Excel workbook fixed the residual divergences. Sizing: Log Management now follows the workbook's row-26 formula (new "Log Management Replicas" input — min 1 Small / 3 Medium-Large, Large deploys 2 nodes per replica, CPU/RAM per node from the VCFMS worker tier, disk = replicas × 575 GB) and gains the missing Large size, replacing the previous flat estimates and the separate "Log Management Replicas" toggle; VCF Automation consolidated into a single component computed from the per-node VCFA table × node count (×1 Small / ×3 Medium-Large); Real-time Metrics scales with the Instance Profile Size (×2 nodes, ×3 for Large); Identity Broker counts only its disk (the workbook excludes its CPU/RAM from every total); Software Depot disk corrected from 0 to 1500 GB; the minimum host count now applies the workbook's 3-host vSAN quorum floor even for Simple deployments. Validation lists: Deploy Cluster Teaming Policy gains "Route Based on Physical NIC Load", certificate Key Size fields gain 3072, Supervisor Control Plane Size gains XLarge, Log Management Size gains Large, management-domain vSAN FTT restricted to 1-2, and the "NSX Connectivity Type" / "Transit Gateway Type" casing corrected to match each field's actual workbook validation list (the v1.1.1 change had matched the wrong cells). `tools/sizing_scenarios.md` scenarios 2-3 updated to the corrected expected values; `tools/check_lt_constants.py` still passes.
- **v1.1.1** (2026-06-12) — Sizing calculator aligned with the Excel workbook: the Management Domain Sizing lookup tables and formulas were re-verified line-by-line against `vcf-9.1-planning-and-preparation-workbook-updated.xlsx` ("Static Reference Tables" and "Management Domain Sizing" sheets) and corrected where they had drifted — SDDC Manager RAM (8 → 16 GB), NSX Manager (added Extra-Small tier, corrected XLarge), NSX Edge/VNA disk sizes (→ 200 GB) and VNA CPU/RAM, VCF Operations CPU/RAM/disk, AVI Load Balancer Large/Extra-Large, Cloud Proxy tiers (renamed "Standard" → "Medium", added "Large"), and a full rework of vDefend SSP into cluster-aggregate values plus a separate "vDefend/AVI Licensing Hub" add-on. VCF Services Runtime (VCFMS) control/worker node sizing is now computed from node-count tables driven by Instance Profile Size, Cluster Model, and a new "VCF Services Instance Model" selector (First Instance / Additional Instance), matching the Excel's per-node × node-count + extra-disk formula. The disk-sizing chain (Required Hosts, Total Storage Required, Disk per Host) now follows the Excel's exact order of operations (interim total → FTT1 redundancy → ops reserve → growth, with a floating-point-safe `ROUNDUP`), and Subnet Mask options now cover the full /32-/0 range (33 entries, was 24). New sizing components: VRMS, SRM, Health Reporting and Monitoring (HVM), Cloud-Based Ransomware Recovery, and HCX Connector, plus Identity Broker / VCF Operations for Networks / VCF Operations for Networks Collector upgraded from single-size placeholders to full size-tier tables. Minor validation fixes: added the "Route Based on Physical NIC Load" Teaming Policy option and corrected "NSX Connectivity Type" casing. New `tools/check_lt_constants.py` script and `tools/sizing_scenarios.md` allow re-verifying these lookup tables and formulas against the Excel workbook in the future.
- **v1.1.0** (2026-06-11) — DEMO data, AD toggle, Log Management replicas & navigation improvements: a new "🧪 DEMO" topbar button instantly fills every Management Domain field (Planning, Deploy Management Domain, vCenter, SDDC Manager, a 3-node NSX Manager cluster, and a 2-node NSX Edge cluster) with a consistent example based on a 4-node vSAN-ESA cluster, with a confirmation prompt before overwriting existing values. The Active Directory / LDAP page gains an "Include/Exclude" toggle (default Exclude, consistent with the AVI/NSX Edge/VCF Operations toggles) that hides the detailed AD inputs until needed. Log Management (VCF Management Services / Fleet Management Day-N) gains an HA Mode selector with dedicated replica node and load balancer/cluster VIP FQDN/IP fields for "HA Cluster" mode. VCF Management Services adds 3 spare "Additional IP" fields for fleet-level scale-out. Fleet MTU now defaults to 1500 (was 9000). All password fields default to "AUTO-GENERATED" as a uniform placeholder convention. Navigation: a persistent "🔌 Ports" topbar button and an As-Built page callout banner link directly to the Ports & Protocols reference, which also gains a "Group by: By Component / By Category" toggle organizing the 19 components into 5 functional categories (Core Infrastructure, Fleet Management & Operations, Automation & Security, Recovery & Disaster Recovery, Private AI); within "By Category", each category is further sub-divided into collapsible per-component groups.
- **v1.0.9** (2026-06-11) — Live ports matrix & security hardening: the Ports & Protocols page gains a "Show my configured values" toggle that resolves each row's generic Source/Destination role (vCenter, ESXi hosts, NSX Manager/Edges, SDDC Manager, VCF Operations, AD, DNS/NTP, AVI, HCX, VCF Automation, VCF Operations for Networks, Log Management, vSAN Witness, Identity Broker) to the FQDN/IP you actually configured, with matching "Resolved Source/Destination" columns in the CSV export — turning the reference matrix into an as-built firewall rule list. Security: Alpine.js and @alpinejs/collapse CDN scripts are pinned to v3.14.1 with Subresource Integrity (SRI) hashes; added a "Privacy & Data Handling" section to the About page and README.
- **v1.0.8** (2026-06-11) — Ports & Protocols reference page: new "🔌 Ports & Protocols" page (Reference section) with a searchable, filterable matrix of 1083 port/protocol entries across all 19 VCF 9.1 components, sourced from Broadcom's official [Ports and Protocols Tool](https://ports.broadcom.com/). Browse grouped by component (collapsible groups), or filter by free-text search, traffic direction (Inbound/Outbound/Bidirectional/Unspecified), and component, with a "Show 100 more" pager. Includes a dedicated CSV export of the filtered rows for firewall rule planning. Reference-only — not part of the VCF Installer JSON export or As-Built report.
- **v1.0.7** (2026-06-11) — Aligned with workbook v1.9.1.002 & Advanced Sizer: the Management Domain Sizing calculator gains a vCenter Storage Size selector (Default/Large/XLarge), an NSX Manager Model selector (Mandatory - Single Node ×1 / Mandatory - HA Cluster ×3, replacing the previous hardcoded ×3), and a Cloud Proxy Small/Standard size tier; corrected VCF Automation (VCFA) sizing values to match the workbook's Static Reference Tables; vCenter Server appliance size default changed from Small to Medium; Workload Domain count now supports up to 35; the Configure Workload Domain page adds a WLD Edge HA Mode field (Active-Active / Active-Standby); and Fleet Management Day-N IP samples were renumbered from `10.11.10.x` to `10.11.99.x` to avoid overlap with Management Domain addressing.
- **v1.0.6** (2026-06-10) — Removed Share & Print: the "🔗 Share" (URL-hash state encoding) and "🖨 Print" (browser print / PDF) toolbar buttons have been removed, along with the As-Built page's print button and the on-load URL-hash restore logic, to simplify the toolbar and avoid the size limits and staleness issues of hash-encoded state. Export JSON / Import JSON remain the supported way to back up, share, and restore your configuration, and Markdown / CSV exports remain available for As-Built reporting.
- **v1.0.5** (2026-06-10) — Import "VCF Installer Ready JSON": new "⬆ JSON VCF Installer ready" / "⬆ Import VCF Installer JSON" buttons (topbar and As-Built page) perform a best-effort reverse-import of a `SddcSpec`-shaped JSON (companion to the v1.0.3 export), restoring DNS, NTP, ESXi host FQDNs, network specs, vCenter, cluster, datastore, distributed switch names/MTUs, NSX Manager, VCF Operations, and SDDC Manager fields. A post-import summary flags items that cannot be restored from the spec (host/vCenter/NSX/VCF Operations management IPs, most passwords, the distributed switch profile/uplinks/LACP) for manual review.
- **v1.0.4** (2026-06-10) — VCF Management Services fields: new "VCF Management Services" section on the Fleet Management Day-N page covers Fleet Components FQDN/IP, Instance Components FQDN/IP, VCF Services Runtime FQDN/IP, License Server FQDN/IP, and a shared SSH password for the vmware-system-user account, matching the workbook's "VCF Management services" block. Informational/IPAM only — not part of the VCF Installer JSON export.
- **v1.0.3** (2026-06-10) — VCF Installer JSON export: new "🚀 Installer" / "🚀 VCF Installer JSON" buttons export a `SddcSpec`-shaped JSON matching the VCF 9.1 Installer's `POST /v1/sddcs` payload (DNS, NTP, hosts, network specs, vCenter, cluster, datastore, distributed switches, NSX Manager, VCF Operations, SDDC Manager), built from the current form. Adds a "VCF Installer Export Settings" section (VCF Instance Name, SDDC ID, CEIP, ESXi SSL thumbprint validation). vSphere Supervisor and Fleet/SDDC LCM bootstrap options are not yet covered — review the output against official documentation before use.
- **v1.0.2** (2026-06-10) — Storage type consistency & custom VDS NICs: the Management Domain Sizing "Storage Type" selector now matches "Principal Storage Type" (vSAN-ESA, vSAN-OSA, VMFS on Fibre Channel (FC), NFSv3) and the two stay in sync. The vSAN network segment and "vSAN Datastore Name" are no longer mandatory when FC or NFSv3 is selected. The Distributed Switch Profile now supports up to 10 NIC uplinks for "Custom Switch Configuration".
- **v1.0.1** (2026-06-10) — Bug fix: Include/Exclude toggle fields (Use Proxy, Deploy Cloud Proxy, vSAN Stretched Cluster, Supervisor, Identity Broker, VCF Automation/Logs/Operations for Networks, Site Protection & DR, Cyber Recovery, Ransomware Recovery, Cross Cloud Mobility, Private AI, etc.) now initialize to their documented default value, so the displayed label and the visibility of dependent fields are consistent from the start. Previously some toggles required an Include → Exclude → Include click sequence before their fill-in fields would appear.

---

## Disclaimer

This is a community tool and is not affiliated with or endorsed by Broadcom. Always verify all configuration values against the official [VMware Cloud Foundation 9.1 documentation](https://docs.vmware.com/en/VMware-Cloud-Foundation/) before deployment. The sizing calculator results are estimates — consult VMware's official sizing tools for production deployments.

---

*VCF 9.1 Web Planner · 2026*
