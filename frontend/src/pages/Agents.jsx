import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Play, Pencil,
  Wrench, Zap,
  Globe, Code, Calculator, Database, Clock, FileText,
  Loader2, X, ArrowLeft, Sparkles, DollarSign,
  Copy, Download, Upload, Users
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { agentsApi } from '../api/agents'
import { modelsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import './Agents.css'

const TOOL_ICONS = {
  calculator: Calculator,
  knowledge_base_search: Database,
  get_current_time: Clock,
  web_search: Globe,
  web_scrape: FileText,
  code_execution: Code,
  delegate_to_agent: Users,
}

const Agents = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [templates, setTemplates] = useState([])
  const [tools, setTools] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Views: 'list' | 'create' | 'edit'
  const [view, setView] = useState('list')
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState(null)

  // Create form
  const [form, setForm] = useState({
    name: '',
    description: '',
    instructions: '',
    model: 'gemini-2.0-flash',
    tools: [],
    max_steps: 10,
    temperature: 0.3,
    max_tokens: 2000,
    kb_id: '',
  })



  useEffect(() => {
    loadData()
  }, [])


  const loadData = async () => {
    setLoading(true)
    try {
      const [agentsRes, templatesRes, toolsRes, modelsRes] = await Promise.all([
        agentsApi.list(),
        agentsApi.listTemplates(),
        agentsApi.listTools(),
        modelsApi.list(),
      ])
      setAgents(agentsRes.data?.agents || [])
      setTemplates(templatesRes.data?.templates || [])
      setTools(toolsRes.data?.tools || [])
      setModels(modelsRes.data?.models || [])
    } catch (e) {
      setError('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      if (!payload.kb_id) delete payload.kb_id
      if (!payload.description) delete payload.description
      await agentsApi.create(payload)
      setSuccess('Agent created!')
      setView('list')
      loadData()
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create agent')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      if (!payload.kb_id) delete payload.kb_id
      if (!payload.description) delete payload.description
      await agentsApi.update(editingAgentId, payload)
      setSuccess('Agent updated!')
      setView('list')
      setEditingAgentId(null)
      loadData()
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update agent')
    }
  }

  const openEdit = (agent) => {
    setEditingAgentId(agent.id)
    setForm({
      name: agent.name || '',
      description: agent.description || '',
      instructions: agent.instructions || '',
      model: agent.model || 'gemini-2.0-flash',
      tools: agent.tools || [],
      max_steps: agent.max_steps || 10,
      temperature: agent.temperature || 0.3,
      max_tokens: agent.max_tokens || 2000,
      kb_id: agent.kb_id || '',
    })
    setView('edit')
  }

  const handleCreateFromTemplate = async (templateId) => {
    try {
      await agentsApi.createFromTemplate({ template_id: templateId })
      setSuccess('Agent created from template!')
      setShowTemplates(false)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create from template')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this agent?')) return
    try {
      await agentsApi.delete(id)
      setAgents(agents.filter(a => a.id !== id))
      if (selectedAgent?.id === id) {
        setSelectedAgent(null)
        setView('list')
      }
      setSuccess('Agent deleted')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError('Failed to delete agent')
    }
  }

  const goToPlayground = (agent) => {
    navigate(`/playground?agent=${encodeURIComponent(agent.id)}`)
  }

  const handleClone = async (agent) => {
    try {
      await agentsApi.clone(agent.id)
      setSuccess(`Agent "${agent.name}" cloned!`)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to clone agent')
    }
  }

  const handleExport = async (agent) => {
    try {
      const res = await agentsApi.export(agent.id)
      const config = res.data
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `agent-${agent.name.replace(/\s+/g, '-').toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess('Agent exported!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to export agent')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const config = JSON.parse(text)
      await agentsApi.import(config)
      setSuccess('Agent imported!')
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import agent — check JSON format')
    }
    e.target.value = '' // reset file input
  }

  const resetForm = () => {
    setForm({
      name: '', description: '', instructions: '',
      model: 'gemini-2.0-flash', tools: [],
      max_steps: 10, temperature: 0.3, max_tokens: 2000, kb_id: '',
    })
  }

  const toggleTool = (toolName) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(toolName)
        ? f.tools.filter(t => t !== toolName)
        : [...f.tools, toolName],
    }))
  }

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="ag-page">
        <div className="ag-header">
          <div>
            <h2 className="ag-header__title">Agents</h2>
            <p className="ag-header__sub">Create autonomous AI agents with tools, knowledge bases, and multi-step reasoning</p>
          </div>
          <div className="ag-header__actions">
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Import
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button className="btn-secondary" onClick={() => setShowTemplates(true)}>
              <Sparkles size={16} /> Templates
            </button>
            <button className="btn-primary" onClick={() => setView('create')}>
              <Plus size={16} /> Create Agent
            </button>
          </div>
        </div>

        {error && <div className="ag-toast ag-toast--error"><X size={16} /> {error}</div>}
        {success && <div className="ag-toast ag-toast--success"><Zap size={16} /> {success}</div>}

        {loading ? (
          <div className="ag-loading"><Loader2 className="ag-spin" size={24} /> Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="ag-empty">
            <h3>No agents yet</h3>
            <p>Create your first agent or start from a template</p>
            <div className="ag-empty__actions">
              <button className="btn-primary" onClick={() => setView('create')}>
                <Plus size={16} /> Create Agent
              </button>
              <button className="btn-secondary" onClick={() => setShowTemplates(true)}>
                <Sparkles size={16} /> Browse Templates
              </button>
            </div>
          </div>
        ) : (
          <div className="ag-grid">
            {agents.map(agent => (
              <div key={agent.id} className="ag-card">
                <div className="ag-card__top">
                  <div className="ag-card__info">
                    <h3>{agent.name}</h3>
                    <div className="ag-card__model">{agent.model}</div>
                  </div>
                  <button className="ag-card__edit-inline" onClick={() => openEdit(agent)} title="Edit agent">
                    Edit Agent
                  </button>
                </div>
                {agent.description && <p className="ag-card__desc">{agent.description}</p>}
                <div className="ag-card__chips">
                  {(agent.tools || []).map(t => {
                    const Icon = TOOL_ICONS[t] || Wrench
                    return <span key={t} className="ag-chip"><Icon size={11} /> {t.replace(/_/g, ' ')}</span>
                  })}
                </div>
                <div className="ag-card__bottom">
                  <div className="ag-card__stats">
                    <span>{agent.total_invocations || 0} invocations</span>
                    {agent.pricing?.is_free && <span className="ag-badge ag-badge--free">Free</span>}
                    {agent.pricing && !agent.pricing.is_free && (
                      <span className="ag-badge ag-badge--paid"><DollarSign size={10} /> {agent.pricing.markup}</span>
                    )}
                  </div>
                  <div className="ag-card__btns">
                    <button className="ag-card__edit" onClick={() => handleClone(agent)} title="Clone agent">
                      <Copy size={14} /> Clone
                    </button>
                    <button className="ag-card__edit" onClick={() => handleExport(agent)} title="Export agent">
                      <Download size={14} />
                    </button>
                    <button className="ag-card__edit" onClick={() => openEdit(agent)} title="Edit agent">
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="ag-card__run" onClick={() => goToPlayground(agent)} title="Test in Playground">
                      <Play size={14} /> Playground
                    </button>
                    <button className="ag-card__del" onClick={() => handleDelete(agent.id)} title="Delete agent">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Templates Modal */}
        {showTemplates && (
          <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
            <div className="modal-content templates-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2><Sparkles size={20} /> Agent Templates</h2>
                <button className="btn-icon" onClick={() => setShowTemplates(false)}><X size={18} /></button>
              </div>
              <div className="templates-grid">
                {templates.map(t => (
                  <div key={t.id} className="template-card">
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                    <div className="template-tools">
                      {t.tools.map(tool => <span key={tool} className="tool-badge-sm">{tool.replace(/_/g, ' ')}</span>)}
                    </div>
                    <div className="template-footer">
                      {t.pricing?.is_free ? <span className="free-badge">Free</span> : <span className="cost-badge"><DollarSign size={12} /> Paid</span>}
                      <button className="btn-primary btn-sm" onClick={() => handleCreateFromTemplate(t.id)}>
                        <Plus size={14} /> Use Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── CREATE VIEW ──
  if (view === 'create') {
    return (
      <div className="ag-page ag-page--create">
        <div className="ag-topbar">
          <button className="ag-back" onClick={() => setView('list')}>
            <ArrowLeft size={18} /> Back to Agents
          </button>
        </div>

        <div className="create-agent-container">
          <h2>Create Agent</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleCreate} className="agent-form">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="My Research Agent"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What does this agent do?"
              />
            </div>

            <div className="form-group">
              <label>Instructions *</label>
              <textarea
                value={form.instructions}
                onChange={e => setForm({ ...form, instructions: e.target.value })}
                placeholder="You are a helpful assistant that..."
                rows={5}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Model</label>
                <select
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                >
                  {(() => {
                    const freeModels = models.filter(m => m.is_free)
                    const paidModels = models.filter(m => !m.is_free)
                    return (
                      <>
                        {freeModels.length > 0 && (
                          <optgroup label="Free Models">
                            {freeModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name} (Free)</option>
                            ))}
                          </optgroup>
                        )}
                        {paidModels.length > 0 && (
                          <optgroup label="Paid Models (+45% agent markup)">
                            {paidModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {models.length === 0 && (
                          <option value="">Loading models...</option>
                        )}
                      </>
                    )
                  })()}
                </select>
              </div>
              <div className="form-group">
                <label>Max Steps</label>
                <input
                  type="number"
                  value={form.max_steps}
                  onChange={e => setForm({ ...form, max_steps: parseInt(e.target.value) })}
                  min={1} max={20}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tools</label>
              <div className="tools-selector">
                {tools.map(tool => {
                  const Icon = TOOL_ICONS[tool.name] || Wrench
                  const isSelected = form.tools.includes(tool.name)
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      className={`tool-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTool(tool.name)}
                    >
                      <Icon size={16} />
                      <span>{tool.name.replace(/_/g, ' ')}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Temperature ({form.temperature})</label>
                <input
                  type="range"
                  min="0" max="2" step="0.1"
                  value={form.temperature}
                  onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group flex-1">
                <label>Max Tokens</label>
                <input
                  type="number"
                  value={form.max_tokens}
                  onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) })}
                  min={100} max={32768}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setView('list')}>Cancel</button>
              <button type="submit" className="btn-primary"><Plus size={16} /> Create Agent</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── EDIT VIEW ──
  if (view === 'edit') {
    return (
      <div className="ag-page ag-page--create">
        <div className="ag-topbar">
          <button className="ag-back" onClick={() => { setView('list'); setEditingAgentId(null); resetForm() }}>
            <ArrowLeft size={18} /> Back to Agents
          </button>
        </div>

        <div className="create-agent-container">
          <h2>Edit Agent</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleUpdate} className="agent-form">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="My Research Agent"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What does this agent do?"
              />
            </div>

            <div className="form-group">
              <label>Instructions *</label>
              <textarea
                value={form.instructions}
                onChange={e => setForm({ ...form, instructions: e.target.value })}
                placeholder="You are a helpful assistant that..."
                rows={5}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Model</label>
                <select
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                >
                  {(() => {
                    const freeModels = models.filter(m => m.is_free)
                    const paidModels = models.filter(m => !m.is_free)
                    return (
                      <>
                        {freeModels.length > 0 && (
                          <optgroup label="Free Models">
                            {freeModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name} (Free)</option>
                            ))}
                          </optgroup>
                        )}
                        {paidModels.length > 0 && (
                          <optgroup label="Paid Models (+45% agent markup)">
                            {paidModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {models.length === 0 && (
                          <option value="">Loading models...</option>
                        )}
                      </>
                    )
                  })()}
                </select>
              </div>
              <div className="form-group">
                <label>Max Steps</label>
                <input
                  type="number"
                  value={form.max_steps}
                  onChange={e => setForm({ ...form, max_steps: parseInt(e.target.value) })}
                  min={1} max={20}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tools</label>
              <div className="tools-selector">
                {tools.map(tool => {
                  const Icon = TOOL_ICONS[tool.name] || Wrench
                  const isSelected = form.tools.includes(tool.name)
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      className={`tool-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTool(tool.name)}
                    >
                      <Icon size={16} />
                      <span>{tool.name.replace(/_/g, ' ')}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Temperature ({form.temperature})</label>
                <input
                  type="range"
                  min="0" max="2" step="0.1"
                  value={form.temperature}
                  onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group flex-1">
                <label>Max Tokens</label>
                <input
                  type="number"
                  value={form.max_tokens}
                  onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) })}
                  min={100} max={32768}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => { setView('list'); setEditingAgentId(null); resetForm() }}>Cancel</button>
              <button type="submit" className="btn-primary"><Pencil size={16} /> Update Agent</button>
            </div>
          </form>
        </div>
      </div>
    )
  }



  return null
}

export default Agents
