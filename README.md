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
| **Coverage** | 18 pages · 600+ fields across all 27 original sheets |
| **Deployment modes** | VCF and VVF · New Fleet, Additional Instance, Workload Domain, Additional Cluster |
| **Sizing calculator** | Live host count + disk-per-host formulas matching the Excel workbook · WLD vCenter sizing (Shared/Dedicated with size & storage tier) · Instance Profile Size coupled to Cluster Model (Simple → forced Small) · VCF Management Services & Fleet Components included in component inclusions |
| **Persistence** | Auto-save to `localStorage` · Export/Import JSON |
| **Export** | JSON · Markdown As-Built · CSV IPAM table · Print to PDF |
| **Sharing** | Share URL via `location.hash` (btoa-encoded state) |
| **Validation** | VLAN conflict detection · IP conflict detection · CIDR overlap detection · FQDN format check · Constrained dropdowns matching the official Excel data-validation lists (appliance sizes, vSAN FTT, storage types, subnet masks, …) |
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
| 18 | As-Built / Summary | Full recap, validation panels, export buttons |

---

## Architecture

```
index.html                  ← single file, ~2700 lines
├── <head>
│   ├── Alpine.js 3.14.1    (CDN, defer)
│   ├── @alpinejs/collapse  (CDN, loaded before Alpine core)
│   └── Tailwind CSS CDN    (play CDN, darkMode: 'class')
├── <body>
│   ├── Topbar              fixed header — nav + toolbar buttons
│   ├── Sidebar             nav groups + per-page progress bars
│   └── Main content        page router (x-show per page)
└── <script>
    ├── LT                  Lookup tables (vCenter/NSX/AVI sizes — keys mirror the Excel Data Validation lists)
    ├── SUBNET_MASKS        Canonical 24-entry subnet mask list (from 'Static Reference Tables')
    ├── PREREQ_DATA         Prerequisite checklist rows
    ├── makeNetFields()     Helper — network segment field group
    ├── makeHostFields()    Helper — N×(FQDN+IP) host fields
    ├── makeRackFields()    Helper — multi-rack section
    ├── ALL_PAGES[]         Form schema — all 18 pages
    ├── NAV_GROUPS[]        Sidebar navigation structure
    └── vcfPlanner()        Alpine.js component (state + methods)
```

### Key patterns

- **`ALL_PAGES`** — Array of `{ id, title, sections[] }`. Each section has `fields[]` with `type`, `showWhen`, `required`, `optionsFn`, etc.
- **`showWhen: f => ...`** — Conditional visibility at page / section / field level, driven by `form.*` values.
- **`optionsFn: f => [...]`** — Dynamic dropdown options based on current form state (e.g., DVS profile options differ for VCF vs VVF; EDR installer package name depends on the chosen EDR product).
- **`docLink` / `docLabel`** — Optional on any field; renders an "ⓘ" help bubble next to the label that links to the official Broadcom VCF design documentation for that choice (see e.g. `vcMgmtSize`, `nsxEdgeSize`, `vsanFtt`).
- **`calcHosts()`** — `MAX(min, ceil(CPU/overSub/hostCores), ceil(RAM/hostRAM)+1)` with storage-aware minimums (vSAN=3, non-vSAN=2, Simple=1, HA=4).
- **Persistence key** — `localStorage` key `vcf-planner-v1` stores `{ form, sizing, currentPage, openGroups, openSections }`.

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
| 🚀 Installer | Export a VCF Installer `SddcSpec` JSON (`POST /v1/sddcs` payload) |
| ⬆ Installer | Best-effort import of a VCF Installer `SddcSpec` JSON back into the form |
| 🔗 Share | Encode state in URL hash and copy to clipboard |
| 🖨 Print | Browser print dialog (sidebar hidden via CSS) |
| 🌙 / ☀️ | Toggle dark / light mode |
| ↺ Reset | Clear all form data (with confirmation) |

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

---

## Stack

| Library | Version | Purpose |
|---|---|---|
| [Alpine.js](https://alpinejs.dev) | 3.14.1 | Reactivity, templating, state |
| [@alpinejs/collapse](https://alpinejs.dev/plugins/collapse) | 3.x | Animated accordion sections |
| [Tailwind CSS](https://tailwindcss.com) | CDN (play) | Utility-first styling, dark mode |

---

## Changelog

- **v1.0.1** (2026-06-10) — Bug fix: Include/Exclude toggle fields (Use Proxy, Deploy Cloud Proxy, vSAN Stretched Cluster, Supervisor, Identity Broker, VCF Automation/Logs/Operations for Networks, Site Protection & DR, Cyber Recovery, Ransomware Recovery, Cross Cloud Mobility, Private AI, etc.) now initialize to their documented default value, so the displayed label and the visibility of dependent fields are consistent from the start. Previously some toggles required an Include → Exclude → Include click sequence before their fill-in fields would appear.
- **v1.0.2** (2026-06-10) — Storage type consistency & custom VDS NICs: the Management Domain Sizing "Storage Type" selector now matches "Principal Storage Type" (vSAN-ESA, vSAN-OSA, VMFS on Fibre Channel (FC), NFSv3) and the two stay in sync. The vSAN network segment and "vSAN Datastore Name" are no longer mandatory when FC or NFSv3 is selected. The Distributed Switch Profile now supports up to 10 NIC uplinks for "Custom Switch Configuration".
- **v1.0.3** (2026-06-10) — VCF Installer JSON export: new "🚀 Installer" / "🚀 VCF Installer JSON" buttons export a `SddcSpec`-shaped JSON matching the VCF 9.1 Installer's `POST /v1/sddcs` payload (DNS, NTP, hosts, network specs, vCenter, cluster, datastore, distributed switches, NSX Manager, VCF Operations, SDDC Manager), built from the current form. Adds a "VCF Installer Export Settings" section (VCF Instance Name, SDDC ID, CEIP, ESXi SSL thumbprint validation). vSphere Supervisor and Fleet/SDDC LCM bootstrap options are not yet covered — review the output against official documentation before use.
- **v1.0.4** (2026-06-10) — VCF Management Services fields: new "VCF Management Services" section on the Fleet Management Day-N page covers Fleet Components FQDN/IP, Instance Components FQDN/IP, VCF Services Runtime FQDN/IP, License Server FQDN/IP, and a shared SSH password for the vmware-system-user account, matching the workbook's "VCF Management services" block. Informational/IPAM only — not part of the VCF Installer JSON export.
- **v1.0.5** (2026-06-10) — Import "VCF Installer Ready JSON": new "⬆ JSON VCF Installer ready" / "⬆ Import VCF Installer JSON" buttons (topbar and As-Built page) perform a best-effort reverse-import of a `SddcSpec`-shaped JSON (companion to the v1.0.3 export), restoring DNS, NTP, ESXi host FQDNs, network specs, vCenter, cluster, datastore, distributed switch names/MTUs, NSX Manager, VCF Operations, and SDDC Manager fields. A post-import summary flags items that cannot be restored from the spec (host/vCenter/NSX/VCF Operations management IPs, most passwords, the distributed switch profile/uplinks/LACP) for manual review.

---

## Disclaimer

This is a community tool and is not affiliated with or endorsed by Broadcom. Always verify all configuration values against the official [VMware Cloud Foundation 9.1 documentation](https://docs.vmware.com/en/VMware-Cloud-Foundation/) before deployment. The sizing calculator results are estimates — consult VMware's official sizing tools for production deployments.

---

*VCF 9.1 Web Planner · v1.0 · 2026*
