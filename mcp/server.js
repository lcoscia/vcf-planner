// server.js — Streamable HTTP MCP server for the VCF Planner. Mounts the MCP
// endpoint at "/" and works as a remote custom connector for both Claude and
// ChatGPT. Unauthenticated, read-only.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerTools } from './tools.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))

const PORT = Number(process.env.PORT) || 3000

// Build the MCP server (one instance; tools are stateless / read-only).
function buildServer() {
  const server = new McpServer({ name: 'vcf-planner', version: pkg.version })
  registerTools(server)
  return server
}

const app = express()
app.use(express.json({ limit: '4mb' }))

// Permissive CORS for browser-based MCP clients.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, mcp-session-id, mcp-protocol-version, Last-Event-ID',
  )
  res.header('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version')
  res.header('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Health check.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))

// Stateless Streamable HTTP: a fresh server+transport per request. Robust across
// Claude and ChatGPT, which differ in session handling.
async function handleMcp(req, res) {
  try {
    const server = buildServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    })
    res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('MCP request error:', err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
}

app.post('/', handleMcp)

// GET/DELETE on a stateless server have no SSE stream / session to act on.
app.get('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Use POST for the MCP endpoint.' },
    id: null,
  })
})
app.delete('/', (_req, res) => res.status(204).end())

app.listen(PORT, () => {
  console.log(`VCF Planner MCP server (v${pkg.version}) listening on http://0.0.0.0:${PORT}/`)
  console.log(`  MCP endpoint:  POST http://0.0.0.0:${PORT}/`)
  console.log(`  Health check:  GET  http://0.0.0.0:${PORT}/health`)
})
