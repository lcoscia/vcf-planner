# VCF 9.1 Planning & Preparation Workbook — Web Edition

A browser-only interactive replacement for Broadcom's official **VMware Cloud Foundation 9.1 Planning & Preparation Workbook** (27-sheet Excel). No build step and no application backend — `index.html` plus a small set of static ES modules under `core/`.

The shared sizing logic and reference tables now live in `core/` so they can be reused by both the website and an optional **MCP server** (`mcp/`) that exposes the same calculator and reference data to AI assistants (Claude, ChatGPT). See [`mcp/README.md`](mcp/README.md).

---

## Quick Start

`index.html` loads its logic from `./core/*.js` as native ES modules. Browsers block ES-module imports over the `file://` protocol, so serve the folder over HTTP instead of double-clicking the file:

```bash
# From the project root, serve over a local HTTP server, then open the printed URL
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

The published site (GitHub Pages, served over HTTPS at `vcfplanning.lcoscia.fr`) works the same way — nothing to install. Any static web server works; only the `file://` double-click shortcut is no longer supported.

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
core/                       ← shared source of truth (native ES modules, no build) — also consumed by mcp/
├── data.js                 LT lookup tables + SUBNET_MASKS (verified by tools/check_lt_constants.py)
├── ports.js                PORTS_DATA — Ports & Protocols matrix (1083 rows — source: ports.broadcom.com)
├── reference.js            PREREQ_DATA + ALL_PAGES form schema + field-factory helpers (makeNetFields/makeHostFields/makeRackFields/…)
├── sizing.js               Pure sizing calculator (calcHosts/calcTotalDisk/… + computeSizing) — mirrors the Excel formulas
├── validation.js           isValidIp/isValidCidr/isFqdn + VLAN/IP/CIDR conflict detection
└── index.js                Barrel re-export

index.html                  ← the website (imports from ./core/)
├── <head>
│   └── Tailwind CSS CDN    (play CDN, darkMode: 'class')
├── <body>
│   ├── Topbar              fixed header — nav + toolbar buttons
│   ├── Sidebar             nav groups + per-page progress bars
│   ├── Main content        page router (x-show per page)
│   ├── <script type=module> import * as Core from './core/index.js'  → window.vcfPlanner (Alpine methods delegate to Core.*)
│   └── Alpine.js 3.14.1 + @alpinejs/collapse  (CDN, defer — loaded AFTER the module so window.vcfPlanner exists first)
└── (NAV_GROUPS, the VCF-Installer import/export helpers, and vcfPlanner() stay inline in index.html)

mcp/                        ← optional remote MCP server (Node + @modelcontextprotocol/sdk) — imports ../core/
```

> **Single source of truth:** the sizing math and reference tables exist once, in `core/`. `index.html`'s Alpine methods are thin wrappers (`calcHosts() { return Core.calcHosts(this.sizing) }`) and the MCP server calls the same functions, so the website and the AI tools can never drift apart.

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
| **Import ▾** — Import JSON | Load a previously exported JSON file |
| **Import ▾** — Import VCF Installer JSON | Best-effort import of a VCF Installer `SddcSpec` JSON back into the form |
| **Import ▾** — Import Excel Workbook | Parses an official Broadcom `.xlsx` workbook file **entirely client-side** (SheetJS, loaded via CDN with SRI) and pre-fills the form from the recognized cells; shows a post-import report (applied / ignored / ambiguous fields) — see [Privacy & Data Handling](#privacy--data-handling) and [Development](#development) |
| **Export ▾** — Export JSON | Export current form state as JSON |
| **Export ▾** — Export Markdown | Export As-Built report as Markdown |
| **Export ▾** — Export CSV | Export all IP/text fields as CSV (IPAM) |
| **Export ▾** — Export VCF Installer JSON | Export a VCF Installer `SddcSpec` JSON (`POST /v1/sddcs` payload) |
| 🔌 Ports | Jump to the Ports & Protocols reference page |
| ℹ️ About | Jump to the About page |
| 💬 Feedback | Opens a pre-filled GitHub issue (app version, current page, browser user-agent) in a new tab to report a problem or missing feature |
| 🌙 / ☀️ | Toggle dark / light mode |
| 🧪 DEMO | Fill all Management Domain fields with example data (4-node vSAN-ESA cluster + NSX Edge) — confirmation required |
| ↺ Reset | Clear all form data (with confirmation) |

---

## MCP Server (use the planner from Claude / ChatGPT)

The `mcp/` folder contains an optional [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the same sizing calculator and reference data (it imports `../core/`, so it can never drift from the website). It lets an AI assistant answer questions like *"how many hosts for this management domain?"* or *"which ports does NSX Manager need?"* without the web UI.

It is a **remote (HTTP) server, read-only, no authentication** — the one transport that works for both Claude and ChatGPT. Full tool list and setup details are in [`mcp/README.md`](mcp/README.md).

### Fastest way to use it (2 commands, local)

No checkout, no build — run the **pre-built image** from GitHub Container Registry, then add it to Claude Code:

```bash
docker run -d -p 3000:3000 ghcr.io/lcoscia/vcf-planner-mcp:latest   # 1. start the server
claude mcp add --transport http vcf-planner http://localhost:3000/  # 2. register it in Claude Code
```

Now ask Claude things like *"use vcf-planner to size an HA vSAN-ESA management domain"*. From the **Docker Desktop GUI** you can instead search `ghcr.io/lcoscia/vcf-planner-mcp`, hit **Run**, and map port `3000`.

### Run from source instead

```bash
cd mcp
npm install && npm start            # → http://localhost:3000/   (or: docker compose up -d --build)
```

### Point a client at it — local vs. cloud

Whether plain `http://localhost:3000/` works depends on **who opens the connection**. Local clients run on your machine and can reach localhost directly; the web/cloud clients connect from the provider's servers and cannot.

| Client | Connects from | `http://localhost:3000` works? |
|---|---|---|
| **Claude Code** (CLI) | your machine | ✅ yes, directly |
| **Claude Desktop** (app) | your machine | ✅ yes (local HTTP allowed) |
| **claude.ai** (web) | Anthropic's servers | ❌ needs a public HTTPS URL |
| **ChatGPT** | OpenAI's servers | ❌ needs a public HTTPS URL |

**Local Claude (no domain, no TLS):**

```bash
claude mcp add --transport http vcf-planner http://localhost:3000/      # Claude Code
```

For Claude Desktop, add the same URL under Settings → Connectors (or via `claude_desktop_config.json`).

**claude.ai web or ChatGPT, without hosting a server** — keep the container local and expose it through a temporary HTTPS tunnel, then paste the `https://…` URL it prints into the connector settings (claude.ai → Settings → Connectors; ChatGPT → Developer Mode → Connectors, auth *None*):

```bash
cloudflared tunnel --url http://localhost:3000      # → https://<random>.trycloudflare.com
# or: ngrok http 3000
```

The tunnel URL lives only while the command runs and changes on each restart (unless you use a named cloudflare/ngrok tunnel). For a **stable, permanent** URL, deploy the container behind a domain with automatic TLS — see `mcp/Caddyfile.example` and [`mcp/README.md`](mcp/README.md).

---

## Privacy & Data Handling

This tool makes **zero network requests containing your data**. All processing happens client-side; the only network traffic is the one-time load of the Alpine.js / Tailwind CDN scripts on page load (none of which receive form data). Your configuration is saved only to your browser's `localStorage` (key `vcf-planner-v1`), which other websites cannot read due to the browser's same-origin policy.

The Alpine.js and `@alpinejs/collapse` scripts are loaded with **Subresource Integrity (SRI)** hashes (pinned to v3.14.1), so the browser refuses to run them if the CDN ever serves a modified file.

**Import Excel Workbook** (see Toolbar Buttons) follows the same guarantee: the `.xlsx` file you select is parsed entirely in the browser via SheetJS (also CDN-loaded with an SRI hash) — its content is never uploaded or sent over the network, only read locally to pre-fill the form.

⚠️ **Password fields are stored in plaintext** in `localStorage` and are included unencrypted in **Export JSON** backups (root/SSO/SSH passwords, API keys/tokens) and, where applicable, in the **VCF Installer JSON** export (ESXi root and vCenter root passwords only). Treat exported `.json` files as sensitive credentials — don't commit them to public repos or share over unencrypted channels. Anyone with access to the same browser profile/device can also read this data via DevTools, as with any localStorage-based app.

---

## Development

No npm, no build step for the website. Edit `index.html` for the UI, or the `core/*.js` modules for the sizing logic and reference data (shared with the MCP server). Serve over HTTP while developing (see Quick Start) — `file://` will not load the ES modules.

To add a new field, add an entry to the relevant `sections[].fields[]` array in `ALL_PAGES` (now in `core/reference.js`):

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

To add a new page, add an entry to `ALL_PAGES` (`core/reference.js`) and a corresponding item to `NAV_GROUPS` (still in `index.html`).

### Excel import mapping

The Import Excel Workbook feature's cell→field mapping lives in `core/excel-import.js`, in a single `EXCEL_IMPORT_MAP` structure (sheet name + cell reference → form field `key`, mirroring the `ALL_PAGES` field keys from `core/reference.js`). As of v1.1.12, every entry has been verified directly against a real workbook export (label + sample value checked per cell) — but only for the "Deploy Management Domain" and "Configure Management Domain" sheets, and only for the subset of fields listed there (see the "NOT MAPPED" / TODO comments in the file for what's deliberately excluded: SFTP/CA toggles, NSX connectivity, vSphere Supervisor, per-host/per-uplink/per-portgroup repeating tables, and a few fields with no workbook equivalent). To extend coverage or re-validate after a new workbook revision, place a real copy of the current `vcf-9.1-planning-and-preparation-workbook-*.xlsx` next to `index.html` (same gitignored location already used by `tools/check_lt_constants.py`), run an import through the UI, and compare the post-import report's applied/skipped/ambiguous fields against the workbook's actual cell contents before adjusting `EXCEL_IMPORT_MAP` — never guess a coordinate from the form's field order alone, that's exactly what produced the wrong-column bug fixed in v1.1.12.

### Verification

The sizing calculator's lookup tables (`const LT`) and `SUBNET_MASKS` (now in `core/data.js`) are checked
against the official `vcf-9.1-planning-and-preparation-workbook-updated.xlsx` workbook ("Static Reference
Tables" sheet) by:

```bash
python3 tools/check_lt_constants.py
```

The workbook itself is gitignored (not redistributed with this repo) — place a copy next to `index.html`
to run the check. It prints a ✓/✗ report per component/tier and exits non-zero on any divergence.

`tools/sizing_scenarios.md` documents 3 end-to-end Management Domain Sizing scenarios (inputs +
expected "Required Hosts" / "Total Storage Required" / "Disk per Host" results, cross-checked against
the Excel's `Management Domain Sizing` sheet). These same three scenarios are now also locked in as an
automated regression test against `core/sizing.js`:

```bash
node --test mcp/test/scenarios.test.js
```

---

## Stack

| Library | Version | Purpose |
|---|---|---|
| [Alpine.js](https://alpinejs.dev) | 3.14.1 | Reactivity, templating, state |
| [@alpinejs/collapse](https://alpinejs.dev/plugins/collapse) | 3.x | Animated accordion sections |
| [Tailwind CSS](https://tailwindcss.com) | CDN (play) | Utility-first styling, dark mode |

---

## Changelog

- **v1.1.14** (2026-07-23) — Workload Domain NSX Manager sizing: independent Shared/Dedicated model: analysis of the official workbook's "Management Domain Sizing" sheet (`sizing_w0N_nsxt_model` / `sizing_w0N_nsxt_appliance_size`, rows 44-78) showed each Workload Domain has its own independent NSX Manager configuration — **Shared / Dedicated - Single Node / Dedicated - HA Cluster** model and **Small/Medium/Large/XLarge** appliance size, defaulting to Dedicated - HA Cluster / Large — entirely decoupled from the Management Domain's own NSX Manager toggle. `core/sizing.js`'s `wldPerDomain()` previously hardcoded every Workload Domain to 3× NSX Manager Small, gated on the Management Domain's `nsx_manager` toggle instead of a per-WLD choice. A new `wldNsxPerDomain()` helper implements the correct per-WLD Shared(=0 nodes)/Dedicated-Single(=1)/Dedicated-HA(=3) logic, exposed via new **WLD NSX Manager Model** and **Size** selectors, with the sizing breakdown now showing separate "Workload Domain vCenter" and "Workload Domain NSX Manager" rows (previously one combined, harder-to-audit row). New regression scenarios added in `mcp/test/scenarios.test.js` covering all three NSX models.
- **v1.1.13** (2026-07-23) — Workload Domains now count fully — and visibly — toward the sizing totals: a user reported the Management Domain Sizing totals seemed to include something they couldn't see or adjust in detail. The **Workload Domains** count was already adding its per-domain vCenter + NSX Manager **vCPU and RAM** to the totals, but **never added disk** (the lookup data existed in `core/data.js` and was simply unused by `calcRawDisk()`), and had **no line item** in `sizingBreakdown()` — so it silently moved the totals with zero explanation. `core/sizing.js` gained a shared `wldPerDomain()` helper, disk is now included in the calculation, a dedicated "Workload Domain vCenter/NSX" row appears in the breakdown table once the count is above zero, and a new **WLD vCenter Size** selector (previously hardcoded to Small) lets you match it to your actual deployment. Also relabeled the **Cloud Proxy** breakdown row to **"VCF Operations — Cloud Proxy"** for consistency with the other VCF Operations rows. New regression coverage added in `mcp/test/scenarios.test.js`.
- **v1.1.12** (2026-07-13) — Fixed Excel Workbook import — was writing wrong values into the form: testing against a real Broadcom workbook export revealed the Excel import (introduced in v1.1.9) was writing **incorrect values** into several fields — its mapping targeted the wrong column on "Deploy Management Domain" (D instead of the real "Your Value" column, L), and several "Configure Management Domain" fields pointed at a "Select Option / Feature / Final Result" summary table instead of real input cells, producing garbage (e.g. `supervisorCidr = "Microsoft"`). `core/excel-import.js`'s `EXCEL_IMPORT_MAP` has been rebuilt with ~45 cell coordinates verified directly against a real workbook export (label + sample value checked per cell, cross-tested against both a blank and a filled-in copy); unverifiable fields (SFTP/CA toggles, NSX connectivity, vSphere Supervisor, a few workbook-only concepts) were removed rather than left as guesses. The workbook's combined "Gateway (CIDR notation)" cell is now correctly split into the form's separate Gateway/CIDR fields, and the detected workbook version is read defensively from the "Version History" sheet's header row rather than a fixed cell.
- **v1.1.11** (2026-07-13) — Higher CPU oversubscription ratios (up to 4:1): the **CPU Oversubscription** selector on the Management Domain Sizing page now offers 1:1 / 2:1 / 3:1 / 4:1, replacing the previous 1:1 / 1.5:1 / 2:1 range, per the workbook v1.9.1.005 changelog ("Added additional CPU oversubscription rates in the Management Domain Sizing Tab") — a systematic re-audit of all 27 sheets' data validations (following up on v1.1.10's diff, which had only compared validations on 2 of the 27 sheets) confirmed this was the only validation-list change in the new workbook revision. Memory Oversubscription, a separate field in the workbook, is unchanged and remains outside this calculator's scope.
- **v1.1.10** (2026-07-13) — Aligned with workbook v1.9.1.005 (25 June 2026): Broadcom's 25 June revision changes only one sizing value versus the prior v1.9.1.004 baseline — **VCF Automation** disk per node corrected (Small 717 → 600 GB, Medium 334 → 900 GB, Large 430 → 1200 GB, verified directly against both workbook revisions, no column/tier inversion). No other lookup table, sheet, or validation list changed. `tools/check_lt_constants.py` now points at the v1.9.1.005 file and gained a dedicated `vcfa` check (the VCF Automation CPU/RAM/Disk table existed in `core/data.js` but wasn't previously cross-checked against the workbook).
- **v1.1.9** (2026-07-13) — Import Excel Workbook (first iteration, unverified cell mapping): a new **Import Excel Workbook** entry in the topbar **Import ▾** menu opens a file picker for the official Broadcom "VCF 9.1 Planning & Preparation Workbook" `.xlsx` file and parses it **entirely client-side** using [SheetJS](https://sheetjs.com/) (loaded from CDN with a Subresource Integrity hash, same pattern as Alpine.js/Tailwind) — the imported file never leaves the browser, consistent with the app's existing "zero network requests containing your data" guarantee. Recognized cells are mapped to form fields via a new `EXCEL_IMPORT_MAP` in `core/excel-import.js` and pre-fill the form; a post-import report panel then lists **applied**, **ignored**, and **ambiguous** fields so the result can be checked before trusting it. ⚠️ This first version's cell→field mapping is a best-effort draft that has **not** been calibrated against a real copy of the workbook (the official `.xlsx` is gitignored and never shipped with this repo) — always review the post-import report and cross-check imported values manually; the mapping will be refined incrementally as it gets validated against real workbook files (see `core/excel-import.js` and the Development section below).
- **v1.1.8** (2026-07-13) — Auto-generate-password toggles, per-portgroup VDS config & Feedback button: the vCenter Management Domain, NSX Edge and Workload Domain password fields gain dedicated **Auto-Generate Password** toggles (`autoGenPw` / `nsxEdgeAutoGenPw` / `wldAutoGenPw`), replacing the static "AUTO-GENERATED" placeholder with an explicit Selected/Unselected control that conditionally reveals the password field and omits the root vCenter password from the VCF Installer JSON export when auto-generation is selected. The Distributed Switch pages gain a **per-portgroup configuration** (name, load balancing, Active/Standby uplink assignment for ESX Mgmt, VM Mgmt, VCF Mgmt, vMotion, vSAN and NFS traffic, plus the NSX overlay portgroup) and MTU/LAG/physical NIC uplink fields for the Primary/Secondary/Tertiary VDS sections. A new **Feedback** button in the topbar (all pages) opens a pre-filled GitHub issue (app version, current page, browser user-agent) in a new tab — no data leaves the browser without the user's explicit submission on GitHub. Contributed by Paul van Dieen (ITQ; password toggles & portgroup config).
- **v1.1.7** (2026-07-10) — EVC Mode moved to day-2, aligned with vSphere 9.0 baselines: the EVC Mode field moved from the Deploy Management Domain "Cluster & Scale Options" to a new **vSphere Cluster Settings** section on the **Configure Management Domain** page — the VCF 9.x Installer offers no EVC selection during bring-up (verified against a real 9.1 deployment); EVC is applied post-deployment in vCenter (cluster → Configure → VMware EVC). The option list was rebuilt to the actual vCenter 9.0 baseline names: **Custom** (new in vSphere 9.0), Intel "Skylake" through "Granite Rapids" Generation, and AMD "Zen" (Naples) through "Zen 5" (Turin) Generation, replacing the previous list (old Intel microarchs, "AMD EPYC Rome/Milan/Genoa" naming). Intel baselines older than Skylake were dropped since those CPU families are discontinued in ESX 9.x; Skylake-SP itself was restored as supported (software support only) in the Broadcom Compatibility Guide on July 7, 2026. The form key (`evcMode`) is unchanged, so saved plans keep their value. Contributed by Paul van Dieen (ITQ).
- **v1.1.5** (2026-06-23) — ITQ brand redesign: ported the visual layer of the claude.ai/design redesign onto `index.html` while keeping all logic and reference data in `core/` (the single source of truth shared with the MCP server) — new ITQ navy palette, Metropolis + Titillium fonts under `assets/fonts/`, a restyled top bar/sidebar, and an ITQ ↔ VMware brand toggle (heart button / `Shift+B`, persisted in `localStorage`). Emoji nav/page icons are now rendered as inline SVGs via a new `iconSvg()` helper; no nav data or `core/` files changed. Contributed by Florian Casse (ITQ).
- **v1.1.4** (2026-06-17) — Aligned with workbook v1.9.1.004 (15 June 2026), credit contributors: recalibrated vCenter disk tiers; the Supervisor Service Platform (SSP) moved from a Medium/Large/X-Large tier model to a fixed Excluded/Include toggle (8 nodes / 96 vCPU / 350 GB RAM / 3867 GB disk); License Hub disk corrected to 725 GB. VCF Operations/Automation deployment is now a single API-only select (Exclude / Deploy VCF Operations and Automation / Deploy VCF Automation), replacing the old independent Include/Exclude toggles, plus a new "Deploy Deferred Components (API-only)" section referencing the official VCF.JSONGenerator PowerShell module. `tools/check_lt_constants.py` now points at the new workbook and validates `vcenter_disk_tiers`. The About page now credits Florian Casse (MCP server & core refactor) and ITQ.
- **v1.1.3** (2026-06-12) — FQDN/IP prerequisites aligned with the VCF 9.1 "Components FQDNs and IP Addresses", "VCF Management Services in the First VCF Instance Model", "VCF Automation Network Design Options" and "VCF Operations for Logs Deployment Models" docs: **Log Management** now reflects 1 FQDN with all IPs (6 initial + 2 per additional replica) drawn from the VCF Services Runtime IP block rather than separate Management VM Network / Fleet VLAN addresses — sample IPs moved from `10.11.10.x` to the `10.11.99.x` Runtime range, and the former "Load Balancer / Cluster VIP" fields are now an optional additional VIP on the same Integrated Load Balancer. **VCF Management Services** gains a clarified description/notes: the VCF Services Runtime IP block must sit on the VCF Management Network with a minimum of 12 IPs (/28) and up to 30 IPs (/27) recommended for Day-N scale-out (Log Management replicas, Real-time Metrics, etc.), and License Server is now explicitly called out as having its own FQDN/IP on the VCF Management Network, separate from the VCF Management Services FQDN set (Fleet Components, Instance Components, VCF Services Runtime, Identity Broker). **Identity Broker** gains a note that its single FQDN is one of the required First VCF Instance Day-0 FQDNs alongside that set. **VCF Automation** gains a new "Dedicated VCF Services Runtime FQDN/IP" pair (1 FQDN, separate from the fleet-level VCF Services Runtime), and its 5-address node IP pool notes are corrected to the documented /29 model — 3 IPs assigned to the VCF Automation 9.1 nodes plus 2 buffer IPs for redeploy/rolling updates, on the VM management network by default or a dedicated VLAN via the fleet lifecycle API. All newly-documented FQDN fields gain a "Do not use capital letters in the FQDN (lowercase only)" note.
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

## Contributors

- **Leonardo Coscia** — creator, sizing calculator & workbook conversion
- **Florian Casse** (ITQ) — MCP server, `core/` shared-module refactor, ITQ brand redesign

---

## Disclaimer

This is a community tool and is not affiliated with or endorsed by Broadcom. Always verify all configuration values against the official [VMware Cloud Foundation 9.1 documentation](https://docs.vmware.com/en/VMware-Cloud-Foundation/) before deployment. The sizing calculator results are estimates — consult VMware's official sizing tools for production deployments.

---

*VCF 9.1 Web Planner · 2026*
