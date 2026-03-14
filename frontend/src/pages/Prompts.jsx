import './Prompts.css'
import { useState, useEffect } from 'react'
import { promptsApi } from '../api/platformServices'
import { modelsApi } from '../api/endpoints'
import { notify } from '../utils/notify'
import {
  FileText, Plus, Trash2, Play, Copy, Edit3, Save, X, Loader2,
  Tag, Clock, ChevronDown, ChevronRight, Variable, Eye, Code,
  Sparkles, History, RefreshCw, Search, Wand2
} from 'lucide-react'

const Prompts = () => {
  const [view, setView] = useState('list')    // list | create | edit | test
  const [prompts, setPrompts] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testVars, setTestVars] = useState({})

  const emptyForm = {
    name: '', description: '', system_prompt: '', user_prompt_template: '',
    model: '', temperature: 0.7, max_tokens: 1024, tags: []
  }
  const [form, setForm] = useState({ ...emptyForm })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [pr, mr] = await Promise.all([promptsApi.list(), modelsApi.list()])
      setPrompts(pr.data?.prompts || pr.data || [])
      setModels(mr.data?.models || mr.data || [])
    } catch (e) { console.error(e); notify('error', 'Failed to load prompts') }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.user_prompt_template.trim()) {
      notify('error', 'Name and prompt template are required'); return
    }
    setSaving(true)
    try {
      await promptsApi.create({
        name: form.name, description: form.description,
        system_prompt: form.system_prompt || undefined,
        user_prompt_template: form.user_prompt_template,
        model: form.model || undefined,
        temperature: form.temperature, max_tokens: form.max_tokens,
        tags: form.tags.length > 0 ? form.tags : undefined
      })
      notify('success', 'Prompt template created!')
      setForm({ ...emptyForm }); setView('list'); loadData()
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to create prompt') }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!selectedPrompt) return
    setSaving(true)
    try {
      await promptsApi.update(selectedPrompt.id, {
        name: form.name, description: form.description,
        system_prompt: form.system_prompt || undefined,
        user_prompt_template: form.user_prompt_template,
        model: form.model || undefined,
        temperature: form.temperature, max_tokens: form.max_tokens,
        tags: form.tags
      })
      notify('success', 'Prompt updated! New version created.')
      setView('list'); loadData()
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to update') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this prompt template?')) return
    try {
      await promptsApi.delete(id)
      notify('success', 'Prompt deleted')
      loadData()
    } catch (e) { notify('error', 'Failed to delete') }
  }

  const openEdit = async (prompt) => {
    setSelectedPrompt(prompt)
    setForm({
      name: prompt.name, description: prompt.description || '',
      system_prompt: prompt.system_prompt || '',
      user_prompt_template: prompt.user_prompt_template || '',
      model: prompt.model || '', temperature: prompt.temperature ?? 0.7,
      max_tokens: prompt.max_tokens ?? 1024, tags: prompt.tags || []
    })
    setView('edit')
  }

  const openTest = async (prompt) => {
    setSelectedPrompt(prompt)
    setTestResult(null)
    // Extract variables from template: {{var_name}}
    const vars = {}
    const matches = (prompt.user_prompt_template || '').matchAll(/\{\{(\w+)\}\}/g)
    for (const m of matches) vars[m[1]] = ''
    setTestVars(vars)
    setView('test')
  }

  const loadVersions = async (prompt) => {
    try {
      const res = await promptsApi.listVersions(prompt.id)
      setVersions(res.data?.versions || res.data || [])
      setShowVersions(true)
    } catch (e) { notify('error', 'Failed to load versions') }
  }

  const handleTest = async () => {
    if (!selectedPrompt) return
    setTesting(true); setTestResult(null)
    try {
      const res = await promptsApi.invoke(selectedPrompt.id, {
        variables: testVars,
        model: form.model || selectedPrompt.model || undefined,
        temperature: selectedPrompt.temperature,
        maxTokens: selectedPrompt.max_tokens
      })
      setTestResult(res.data)
    } catch (e) { setTestResult({ error: e.response?.data?.detail || 'Invocation failed' }) }
    finally { setTesting(false) }
  }

  const handleRender = async () => {
    if (!selectedPrompt) return
    try {
      const res = await promptsApi.render(selectedPrompt.id, testVars)
      setTestResult({ rendered: res.data?.rendered || res.data })
    } catch (e) { notify('error', 'Failed to render') }
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] })
    }
    setTagInput('')
  }

  const removeTag = (t) => setForm({ ...form, tags: form.tags.filter(x => x !== t) })

  const extractVarNames = (template) => {
    const matches = (template || '').matchAll(/\{\{(\w+)\}\}/g)
    return [...new Set([...matches].map(m => m[1]))]
  }

  const filtered = prompts.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    (p.tags || []).some(t => t.includes(search.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading prompts...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">
              {view === 'list' ? 'Prompt Management' : view === 'create' ? 'Create Prompt Template' : view === 'edit' ? 'Edit Prompt' : 'Test Prompt'}
            </h1>
            <p className="ov-header__sub">
              {view === 'list' ? 'Create, version, and test reusable prompt templates.' :
               view === 'create' ? 'Define a new prompt template with variables.' :
               view === 'edit' ? 'Update your prompt — changes create a new version.' :
               `Testing: ${selectedPrompt?.name}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view !== 'list' && (
              <button className="md-btn" onClick={() => { setView('list'); setSelectedPrompt(null); setTestResult(null) }}>← Back</button>
            )}
            {view === 'list' && (
              <button className="md-btn md-btn--primary" onClick={() => { setForm({ ...emptyForm }); setView('create') }}>
                <Plus size={14} /> New Prompt
              </button>
            )}
          </div>
        </div>

        {/* List View */}
        {view === 'list' && (
          <>
            <div className="pm-search-bar">
              <Search size={16} />
              <input type="text" placeholder="Search prompts by name, description, or tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {filtered.length === 0 ? (
              <div className="bl-empty">
                <FileText size={48} strokeWidth={1} />
                <p>{search ? 'No matching prompts' : 'No prompt templates yet'}</p>
                <span>{search ? 'Try a different search term.' : 'Create your first reusable prompt template.'}</span>
                {!search && (
                  <button className="md-btn md-btn--primary" style={{ marginTop: 16 }} onClick={() => { setForm({ ...emptyForm }); setView('create') }}>
                    <Plus size={14} /> Create First Prompt
                  </button>
                )}
              </div>
            ) : (
              <div className="pm-grid">
                {filtered.map(p => (
                  <div key={p.id} className="pm-card">
                    <div className="pm-card__header">
                      <h3 className="pm-card__name">{p.name}</h3>
                      <span className="pm-card__version">v{p.version || 1}</span>
                    </div>
                    {p.description && <p className="pm-card__desc">{p.description}</p>}
                    <div className="pm-card__meta">
                      {p.model && <span className="pm-chip"><Code size={11} /> {p.model}</span>}
                      {(p.tags || []).map(t => <span key={t} className="pm-chip pm-chip--tag"><Tag size={11} /> {t}</span>)}
                      {extractVarNames(p.user_prompt_template).length > 0 && (
                        <span className="pm-chip pm-chip--var"><Variable size={11} /> {extractVarNames(p.user_prompt_template).length} vars</span>
                      )}
                    </div>
                    <div className="pm-card__actions">
                      <button className="md-btn md-btn--sm" onClick={() => openTest(p)} title="Test"><Play size={13} /> Test</button>
                      <button className="md-btn md-btn--sm" onClick={() => openEdit(p)} title="Edit"><Edit3 size={13} /></button>
                      <button className="md-btn md-btn--sm" onClick={() => loadVersions(p)} title="Versions"><History size={13} /></button>
                      <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create / Edit View */}
        {(view === 'create' || view === 'edit') && (
          <div className="pm-form-grid">
            <div className="pm-form-main">
              <div className="st-card">
                <div className="st-card__header"><FileText size={18} /> Template Details</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Template Name *</label>
                    <input className="pg-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Customer Support Reply" />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Description</label>
                    <input className="pg-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this prompt does..." />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">System Prompt</label>
                    <textarea className="pg-input pm-textarea" rows={3} value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} placeholder="Optional system instructions..." />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">User Prompt Template * <small style={{ color: 'var(--text-tertiary)' }}>Use {'{{variable}}'} for dynamic parts</small></label>
                    <textarea className="pg-input pm-textarea pm-textarea--lg" rows={6} value={form.user_prompt_template} onChange={e => setForm({ ...form, user_prompt_template: e.target.value })} placeholder="Summarize the following {{document_type}} document:\n\n{{content}}\n\nProvide key points and action items." />
                  </div>
                  {extractVarNames(form.user_prompt_template).length > 0 && (
                    <div className="pm-var-preview">
                      <Variable size={14} /> Variables detected:
                      {extractVarNames(form.user_prompt_template).map(v => (
                        <code key={v} className="pm-var-tag">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pm-form-side">
              <div className="st-card">
                <div className="st-card__header"><Sparkles size={18} /> Configuration</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Default Model</label>
                    <select className="pg-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                      <option value="">Auto (use caller's model)</option>
                      {models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                    </select>
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Temperature: {form.temperature}</label>
                    <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="pg-range" />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Max Tokens</label>
                    <input type="number" className="pg-input" value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 1024 })} min={1} max={32000} />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Tags</label>
                    <div className="pm-tag-input">
                      <input className="pg-input" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag + Enter" />
                    </div>
                    {form.tags.length > 0 && (
                      <div className="pm-tags-list">
                        {form.tags.map(t => (
                          <span key={t} className="pm-chip pm-chip--tag"><Tag size={11} /> {t} <X size={11} style={{ cursor: 'pointer' }} onClick={() => removeTag(t)} /></span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button className="md-btn md-btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={view === 'create' ? handleCreate : handleUpdate} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : view === 'create' ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Test View */}
        {view === 'test' && selectedPrompt && (
          <div className="pm-form-grid">
            <div className="pm-form-main">
              <div className="st-card">
                <div className="st-card__header"><Code size={18} /> Prompt Template</div>
                <div className="st-card__body">
                  {selectedPrompt.system_prompt && (
                    <div className="pm-preview-block">
                      <label className="pg-field__label">System Prompt</label>
                      <pre className="pm-code">{selectedPrompt.system_prompt}</pre>
                    </div>
                  )}
                  <div className="pm-preview-block">
                    <label className="pg-field__label">User Template</label>
                    <pre className="pm-code">{selectedPrompt.user_prompt_template}</pre>
                  </div>
                </div>
              </div>

              {/* Result */}
              {testResult && (
                <div className="st-card" style={{ marginTop: 16 }}>
                  <div className="st-card__header"><Sparkles size={18} /> Result</div>
                  <div className="st-card__body">
                    {testResult.error ? (
                      <div className="bc-error"><X size={14} /> {testResult.error}</div>
                    ) : testResult.rendered ? (
                      <div className="pm-preview-block">
                        <label className="pg-field__label">Rendered Prompt</label>
                        <pre className="pm-code">{typeof testResult.rendered === 'string' ? testResult.rendered : JSON.stringify(testResult.rendered, null, 2)}</pre>
                      </div>
                    ) : (
                      <>
                        <div className="pm-preview-block">
                          <label className="pg-field__label">Response</label>
                          <div className="pm-result-text">{testResult.response || testResult.content || JSON.stringify(testResult, null, 2)}</div>
                        </div>
                        {testResult.usage && (
                          <div className="pm-result-meta">
                            {testResult.usage.total_tokens && <span>Tokens: {testResult.usage.total_tokens}</span>}
                            {testResult.model && <span>Model: {testResult.model}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pm-form-side">
              <div className="st-card">
                <div className="st-card__header"><Variable size={18} /> Variables</div>
                <div className="st-card__body">
                  {Object.keys(testVars).length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No variables in this template.</p>
                  ) : (
                    Object.entries(testVars).map(([k, v]) => (
                      <div key={k} className="st-field">
                        <label className="pg-field__label">{`{{${k}}}`}</label>
                        <textarea className="pg-input" rows={2} value={v} onChange={e => setTestVars({ ...testVars, [k]: e.target.value })} placeholder={`Enter value for ${k}...`} />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="md-btn" style={{ flex: 1 }} onClick={handleRender}>
                  <Eye size={14} /> Preview
                </button>
                <button className="md-btn md-btn--primary" style={{ flex: 1 }} onClick={handleTest} disabled={testing}>
                  <Play size={14} /> {testing ? 'Running...' : 'Run'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Versions Modal */}
        {showVersions && (
          <div className="pg-modal-overlay" onClick={() => setShowVersions(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Version History</h3><button onClick={() => setShowVersions(false)}><X size={18} /></button></div>
              <div className="ix-modal__body" style={{ maxHeight: 400, overflow: 'auto' }}>
                {versions.length === 0 ? (
                  <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No version history available.</p>
                ) : (
                  versions.map((v, i) => (
                    <div key={i} className="pm-version-item">
                      <div className="pm-version-item__header">
                        <span className="pm-card__version">v{v.version}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span>
                      </div>
                      {v.user_prompt_template && <pre className="pm-code pm-code--sm">{v.user_prompt_template}</pre>}
                    </div>
                  ))
                )}
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn md-btn--primary" onClick={() => setShowVersions(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Prompts
