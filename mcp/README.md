# VCF Planner MCP Server

A remote **Model Context Protocol** server that exposes the VMware Cloud Foundation
9.1 planning & sizing logic of the [VCF Planner](https://vcfplanning.lcoscia.fr/)
as callable tools. It works as a **custom connector for both Claude and ChatGPT**.

- **Transport:** Streamable HTTP, mounted at the root path `/`. No stdio.
- **Auth:** none — this is a **public, read-only** tool. Do not expose anything sensitive behind it.
- **Source of truth:** all sizing math and reference data are imported from the shared
  [`../core`](../core) package. This server never duplicates that logic.

## Tools

| Tool | Purpose |
|------|---------|
| `calculate_management_domain_sizing` | Compute host count and raw/total CPU, RAM, disk (plus a per-component breakdown) from a partial sizing object merged with Excel-workbook defaults. |
| `lookup_component_specs` | Return the vCPU/RAM/disk spec for a component (flat or per-size tier). |
| `list_component_catalog` | List every component key, its shape (flat / tiered / scalar), and available sizes. |
| `search_ports_protocols` | Filter the firewall ports/protocols matrix by product, port, protocol, direction, or free text. |
| `list_prerequisites` | List deployment prerequisites, filterable by category and free text. |
| `validate_network` | Detect VLAN duplicates, IP duplicates, and CIDR overlaps. |
| `search` | **ChatGPT Deep Research** — search the knowledge corpus; returns `{ results: [{id,title,url}] }`. |
| `fetch` | **ChatGPT Deep Research** — fetch one corpus document by id; returns `{id,title,text,url,metadata}`. |

Every tool returns its result both as a JSON text block and as `structuredContent`,
for broad client compatibility. ChatGPT **Deep Research mode** uses the `search` and
`fetch` tools.

## Run locally

```bash
cd mcp
npm install
npm start          # listens on http://0.0.0.0:3000/  (override with PORT)
```

Health check: `GET http://localhost:3000/health` → `{"status":"ok"}`.

Run the regression tests (replays three Excel-verified sizing scenarios):

```bash
npm test           # from mcp/, or:  node --test mcp/test/scenarios.test.js
```

## Run with Docker

The Docker build context must be the **repo root** (the server imports `../core`);
`docker-compose.yml` already sets `context: ..` for you.

```bash
cd mcp
docker compose up -d --build
```

Or by hand, from the repo root:

```bash
docker build -f mcp/Dockerfile -t vcf-planner-mcp .
docker run -d -p 3000:3000 --name vcf-planner-mcp vcf-planner-mcp
```

## Run from the pre-built image (no checkout, no build)

The image is published to **GitHub Container Registry** by `.github/workflows/mcp-image.yml`
(multi-arch: Intel + Apple Silicon). Once published, anyone can run it with a single
command — nothing to clone, nothing to build:

```bash
docker run -d -p 3000:3000 --name vcf-planner-mcp ghcr.io/lcoscia/vcf-planner-mcp:latest
```

Or with Compose (pulls instead of building):

```bash
PORT=3000 docker compose -f compose.published.yml up -d
```

**Docker Desktop (GUI):** in the search bar type `ghcr.io/lcoscia/vcf-planner-mcp`,
**Run**, expose container port `3000`, and the server is up at `http://localhost:3000/`.

> Publishing setup (one-time, on the repo owner's side):
> 1. The workflow runs automatically on push to `main` / on a `v*` tag and pushes to GHCR using the built-in `GITHUB_TOKEN` — **no Docker Hub account or secrets required**.
> 2. After the first run, make the package **public** so others can pull without auth: GitHub → repo → *Packages* → `vcf-planner-mcp` → *Package settings* → *Change visibility → Public*. (For private use, `docker login ghcr.io` with a PAT instead.)
> 3. Prefer Docker Hub? Add `docker/login-action` with `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets and an extra `docker.io/<user>/vcf-planner-mcp` entry in the metadata `images:` list.

## Expose over HTTPS (only for cloud clients)

`http://localhost:3000/` is enough for **Claude Code** and **Claude Desktop** (they run
on your machine). **claude.ai (web)** and **ChatGPT** connect from the provider's
servers, so they need a public `https://` URL — either a quick tunnel
(`cloudflared tunnel --url http://localhost:3000`) or a real domain. For a stable
endpoint, put a TLS-terminating
reverse proxy in front of the container. A ready-to-edit
[`Caddyfile.example`](./Caddyfile.example) (automatic Let's Encrypt TLS) is provided,
with an nginx + certbot alternative in the comments.

```bash
# edit Caddyfile.example -> replace mcp.example.com with your domain, then:
caddy run --config ./Caddyfile.example
```

Your public MCP endpoint is then `https://<your-domain>/`.

## Add as a custom connector

### Claude

1. Settings → **Connectors** → **Add custom connector**.
2. **URL:** `https://<your-domain>/`
3. Authentication: **None**.
4. Save, then enable the connector in a chat. The 8 tools become available.

### ChatGPT

1. Enable **Developer Mode** (Settings → Connectors / Apps → Advanced → Developer mode).
2. **Connectors → Add / Create** a connector.
3. **URL:** `https://<your-domain>/`
4. **Authentication: None**.
5. For **Deep Research**, ChatGPT uses the `search` and `fetch` tools automatically.

> This connector is **unauthenticated and read-only**. It performs planning math
> and returns reference data only; it has no side effects.

## Verify with curl

The endpoint speaks JSON-RPC over Streamable HTTP. You must send
`Accept: application/json, text/event-stream`; responses come back as SSE
(`data: {…}` lines). These exact commands were used to validate the server (here on
test port `3939` — substitute your own):

```bash
# 1. initialize handshake
curl -s -X POST http://localhost:3939/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'

# 2. list tools (expect 8)
curl -s -X POST http://localhost:3939/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. call the sizing tool with defaults
curl -s -X POST http://localhost:3939/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculate_management_domain_sizing","arguments":{}}}'

# 4. ChatGPT Deep Research search
curl -s -X POST http://localhost:3939/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search","arguments":{"query":"443"}}}'

# 5. fetch a corpus document
curl -s -X POST http://localhost:3939/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"fetch","arguments":{"id":"component:vcenter"}}}'
```

The server is **stateless** — no `mcp-session-id` is required between calls.
