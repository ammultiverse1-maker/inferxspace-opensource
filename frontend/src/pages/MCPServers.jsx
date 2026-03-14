import './MCPServers.css'
import { useState, useEffect, useCallback } from 'react'
import { mcpApi } from '../api/platformServices'
import { notify } from '../utils/notify'
import {
  Plug, Plus, Trash2, Save, X, Loader2, RefreshCw, Play,
  CheckCircle, AlertTriangle, Wifi, WifiOff, Server,
  ExternalLink, Copy, ChevronDown, ChevronUp, Zap, Settings2
} from 'lucide-react'

const MCPServers = () => {
  const [view, setView] = useState('list')
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const [expandedServer, setExpandedServer] = useState(null)
  const [testingTool, setTestingTool] = useState(null)
  const [toolArgs, setToolArgs] = useState('{}')
  const [toolResult, setToolResult] = useState(null)

  const emptyForm = {
    name: '',
    url: '',
    transport: 'streamable_http',
    api_key: '',
    headers: {}
  }
  const [form, setForm] = useState({ ...emptyForm })
  const [headerKey, setHeaderKey] = useState('')
  const [headerVal, setHeaderVal] = useState('')

  useEffect(() => { loadServers() }, [])

  const loadServers = async () => {
    setLoading(true)
    try {
      const res = await mcpApi.listServers()
      setServers(res.data?.servers || [])
    } catch (e) { console.error(e); notify('error', 'Failed to load MCP servers') }
    finally { setLoading(false) }
  }

  const handleRegister = async () => {
    if (!form.name.trim()) { notify('error', 'Server name is required'); return }
    if (!form.url.trim()) { notify('error', 'Server URL is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        url: form.url,
        transport: form.transport,
        ...(form.api_key && { api_key: form.api_key }),
        ...(Object.keys(form.headers).length > 0 && { headers: form.headers }),
      }
      const res = await mcpApi.registerServer(payload)
      notify('success', 'MCP server registered!')
      setForm({ ...emptyForm })
      setView('list')
      loadServers()
      // Auto-connect after registration
      if (res.data?.id) {
        handleConnect(res.data.id)
      }
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to register server') }
    finally { setSaving(false) }
  }

  const handleConnect = async (serverId) => {
    setConnecting(serverId)
    try {
      const res = await mcpApi.connectServer(serverId)
      const toolCount = res.data?.tools_count || res.data?.tools?.length || 0
      notify('success', `Connected! ${toolCount} tools discovered`)
      loadServers()
    } catch (e) {
      notify('error', e.response?.data?.detail || 'Connection failed')
    }
    finally { setConnecting(null) }
  }

  const handlePing = async (serverId) => {
    try {
      const res = await mcpApi.pingServer(serverId)
      if (res.data?.status === 'ok') {
        const latency = Math.round(res.data.latency_ms || 0)
        notify('success', `Server is alive (${latency}ms)`)
      } else {
        notify('error', res.data?.error || 'Ping failed')
      }
      loadServers()
    } catch (e) { notify('error', 'Ping failed') }
  }

  const handleRefresh = async (serverId) => {
    try {
      const res = await mcpApi.refreshTools(serverId)
      const count = res.data?.total || 0
      notify('success', `Refreshed: ${count} tools`)
      loadServers()
    } catch (e) { notify('error', 'Refresh failed') }
  }

  const handleDelete = async (serverId) => {
    if (!confirm('Remove this MCP server?')) return
    try {
      await mcpApi.unregisterServer(serverId)
      notify('success', 'Server removed')
      if (expandedServer === serverId) setExpandedServer(null)
      loadServers()
    } catch (e) { notify('error', 'Failed to remove server') }
  }

  const handleCallTool = async (serverId, toolName) => {
    setTestingTool(toolName)
    setToolResult(null)
    try {
      const args = JSON.parse(toolArgs)
      const res = await mcpApi.callTool(serverId, { tool_name: toolName, arguments: args })
      setToolResult(res.data)
    } catch (e) {
      if (e instanceof SyntaxError) {
        notify('error', 'Invalid JSON arguments')
      } else {
        setToolResult({ isError: true, content: [{ type: 'text', text: e.response?.data?.detail || 'Tool call failed' }] })
      }
    }
    finally { setTestingTool(null) }
  }

  const addHeader = () => {
    if (!headerKey.trim()) return
    setForm(prev => ({ ...prev, headers: { ...prev.headers, [headerKey]: headerVal } }))
    setHeaderKey('')
    setHeaderVal('')
  }

  const removeHeader = (key) => {
    setForm(prev => {
      const h = { ...prev.headers }
      delete h[key]
      return { ...prev, headers: h }
    })
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <CheckCircle size={16} className="ix-text--green" />
      case 'error': return <AlertTriangle size={16} className="ix-text--red" />
      case 'disconnected': return <WifiOff size={16} className="ix-text--dim" />
      default: return <Wifi size={16} className="ix-text--dim" />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'connected': return 'Connected'
      case 'error': return 'Error'
      case 'disconnected': return 'Disconnected'
      default: return 'Not connected'
    }
  }

  const loadServerDetails = async (serverId) => {
    try {
      const res = await mcpApi.getServer(serverId)
      // Update the server in our list with full tool details
      setServers(prev => prev.map(s => s.id === serverId ? { ...s, ...res.data } : s))
    } catch (e) { console.error(e) }
  }

  const toggleExpand = (serverId) => {
    if (expandedServer === serverId) {
      setExpandedServer(null)
    } else {
      setExpandedServer(serverId)
      loadServerDetails(serverId)
      setToolResult(null)
      setToolArgs('{}')
    }
  }

  /* ── LIST VIEW ─────────────────────────────────────────────── */
  if (view === 'list') return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Plug size={28} className="page-header-icon" />
          <div>
            <h1>MCP Servers</h1>
            <p className="page-subtitle">Connect external Model Context Protocol servers to extend agent capabilities</p>
          </div>
        </div>
        <button className="md-btn md-btn--primary" onClick={() => { setForm({ ...emptyForm }); setView('register') }}>
          <Plus size={16} /> Add Server
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><Loader2 size={32} className="animate-spin" /></div>
      ) : servers.length === 0 ? (
        <div className="mcp-empty">
          <Server size={48} className="mcp-empty__icon" />
          <h3>No MCP Servers</h3>
          <p>Register an MCP server to discover and use external tools in your agents.</p>
          <button className="md-btn md-btn--primary" onClick={() => setView('register')}>
            <Plus size={16} /> Add Your First Server
          </button>
        </div>
      ) : (
        <div className="mcp-server-list">
          {servers.map(server => (
            <div key={server.id} className={`mcp-server-card ${expandedServer === server.id ? 'mcp-server-card--expanded' : ''}`}>
              <div className="mcp-server-card__header" onClick={() => toggleExpand(server.id)}>
                <div className="mcp-server-card__info">
                  <div className="mcp-server-card__status">
                    {getStatusIcon(server.status)}
                    <span className={`mcp-server-card__status-label mcp-status--${server.status}`}>
                      {getStatusLabel(server.status)}
                    </span>
                  </div>
                  <h3 className="mcp-server-card__name">{server.name}</h3>
                  <div className="mcp-server-card__meta">
                    <span className="mcp-server-card__url">{server.url}</span>
                    <span className="mcp-chip">{server.transport === 'sse' ? 'SSE' : 'HTTP'}</span>
                    <span className="mcp-chip mcp-chip--tools">
                      <Zap size={12} /> {server.tools_count || 0} tools
                    </span>
                  </div>
                </div>
                <div className="mcp-server-card__actions" onClick={e => e.stopPropagation()}>
                  {server.status !== 'connected' ? (
                    <button
                      className="md-btn md-btn--sm md-btn--primary"
                      onClick={() => handleConnect(server.id)}
                      disabled={connecting === server.id}
                    >
                      {connecting === server.id ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                      Connect
                    </button>
                  ) : (
                    <>
                      <button className="md-btn md-btn--sm" onClick={() => handlePing(server.id)} title="Ping">
                        <Wifi size={14} />
                      </button>
                      <button className="md-btn md-btn--sm" onClick={() => handleRefresh(server.id)} title="Refresh tools">
                        <RefreshCw size={14} />
                      </button>
                    </>
                  )}
                  <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => handleDelete(server.id)} title="Remove">
                    <Trash2 size={14} />
                  </button>
                  {expandedServer === server.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedServer === server.id && (
                <div className="mcp-server-card__body">
                  {server.server_info?.name && (
                    <div className="mcp-server-info">
                      <span><strong>Server:</strong> {server.server_info.name} {server.server_info.version && `v${server.server_info.version}`}</span>
                    </div>
                  )}
                  {server.error && (
                    <div className="mcp-server-error">
                      <AlertTriangle size={14} /> {server.error}
                    </div>
                  )}

                  <h4 className="mcp-tools-title">
                    <Zap size={16} /> Discovered Tools ({(server.tools || []).length})
                  </h4>

                  {(!server.tools || server.tools.length === 0) ? (
                    <p className="mcp-no-tools">No tools discovered. Connect to the server first.</p>
                  ) : (
                    <div className="mcp-tools-grid">
                      {server.tools.map((tool, idx) => (
                        <div key={idx} className="mcp-tool-card">
                          <div className="mcp-tool-card__header">
                            <span className="mcp-tool-card__name">{tool.name}</span>
                          </div>
                          <p className="mcp-tool-card__desc">{tool.description || 'No description'}</p>
                          {tool.inputSchema?.properties && (
                            <div className="mcp-tool-card__params">
                              {Object.entries(tool.inputSchema.properties).map(([k, v]) => (
                                <span key={k} className="mcp-chip mcp-chip--param">
                                  {k}: {v.type || 'any'}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mcp-tool-card__actions">
                            <button
                              className="md-btn md-btn--sm"
                              onClick={() => {
                                setTestingTool(null)
                                setToolResult(null)
                                setToolArgs(JSON.stringify(
                                  Object.fromEntries(
                                    Object.entries(tool.inputSchema?.properties || {}).map(([k, v]) => [k, v.default || ''])
                                  ), null, 2
                                ))
                                // scroll into view is handled by expanding
                              }}
                            >
                              <Settings2 size={12} /> Set Args
                            </button>
                            <button
                              className="md-btn md-btn--sm md-btn--primary"
                              onClick={() => handleCallTool(server.id, tool.name)}
                              disabled={testingTool === tool.name}
                            >
                              {testingTool === tool.name
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Play size={12} />
                              }
                              Call
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tool testing area */}
                  <div className="mcp-tool-test">
                    <h4><Play size={16} /> Test Tool Call</h4>
                    <label className="md-label">Arguments (JSON)</label>
                    <textarea
                      className="md-textarea mcp-tool-args"
                      rows={4}
                      value={toolArgs}
                      onChange={e => setToolArgs(e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                    {toolResult && (
                      <div className={`mcp-tool-result ${toolResult.isError ? 'mcp-tool-result--error' : 'mcp-tool-result--success'}`}>
                        <h5>{toolResult.isError ? '❌ Error' : '✅ Result'}</h5>
                        <pre className="mcp-tool-result__content">
                          {(toolResult.content || [])
                            .filter(c => c.type === 'text')
                            .map(c => c.text)
                            .join('\n') || JSON.stringify(toolResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {server.last_connected_at && (
                    <p className="mcp-server-meta">
                      Last connected: {new Date(server.last_connected_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  /* ── REGISTER VIEW ─────────────────────────────────────────── */
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Plug size={28} className="page-header-icon" />
          <div>
            <h1>Add MCP Server</h1>
            <p className="page-subtitle">Register an external Model Context Protocol server</p>
          </div>
        </div>
        <button className="md-btn" onClick={() => { setView('list'); setForm({ ...emptyForm }) }}>
          <X size={16} /> Cancel
        </button>
      </div>

      <div className="mcp-form">
        <div className="mcp-form__main">
          <div className="md-field">
            <label className="md-label">Server Name *</label>
            <input
              className="md-input"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. My GitHub Server"
            />
          </div>

          <div className="md-field">
            <label className="md-label">Server URL *</label>
            <input
              className="md-input"
              value={form.url}
              onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://mcp.example.com/mcp"
            />
            <span className="md-hint">The MCP endpoint that accepts JSON-RPC requests</span>
          </div>

          <div className="md-field">
            <label className="md-label">Transport</label>
            <div className="mcp-transport-select">
              {['streamable_http', 'sse'].map(t => (
                <button
                  key={t}
                  className={`mcp-transport-btn ${form.transport === t ? 'mcp-transport-btn--active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, transport: t }))}
                >
                  {t === 'streamable_http' ? 'Streamable HTTP' : 'SSE'}
                </button>
              ))}
            </div>
          </div>

          <div className="md-field">
            <label className="md-label">API Key (optional)</label>
            <input
              className="md-input"
              type="password"
              value={form.api_key}
              onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))}
              placeholder="Bearer token for authentication"
            />
          </div>

          <div className="md-field">
            <label className="md-label">Custom Headers (optional)</label>
            <div className="mcp-header-input">
              <input
                className="md-input"
                value={headerKey}
                onChange={e => setHeaderKey(e.target.value)}
                placeholder="Header name"
                style={{ flex: 1 }}
              />
              <input
                className="md-input"
                value={headerVal}
                onChange={e => setHeaderVal(e.target.value)}
                placeholder="Header value"
                style={{ flex: 2 }}
              />
              <button className="md-btn md-btn--sm" onClick={addHeader}>
                <Plus size={14} />
              </button>
            </div>
            {Object.keys(form.headers).length > 0 && (
              <div className="mcp-headers-list">
                {Object.entries(form.headers).map(([k, v]) => (
                  <div key={k} className="mcp-header-item">
                    <code>{k}: {v}</code>
                    <button className="md-btn--icon" onClick={() => removeHeader(k)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mcp-form__sidebar">
          <div className="mcp-info-card">
            <h4><Plug size={16} /> What is MCP?</h4>
            <p>
              The <strong>Model Context Protocol</strong> lets AI agents connect to external
              tools and data sources through a standardized interface.
            </p>
            <ul>
              <li>Discover tools automatically</li>
              <li>Call tools via JSON-RPC</li>
              <li>Attach to agents for autonomous use</li>
            </ul>
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="mcp-info-link">
              Learn more <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      <div className="mcp-form__actions">
        <button className="md-btn" onClick={() => { setView('list'); setForm({ ...emptyForm }) }}>Cancel</button>
        <button className="md-btn md-btn--primary" onClick={handleRegister} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Register & Connect
        </button>
      </div>
    </div>
  )
}

export default MCPServers
