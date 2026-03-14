import './Guardrails.css'
import { useState, useEffect } from 'react'
import { guardrailsApi } from '../api/platformServices'
import { notify } from '../utils/notify'
import {
  Shield, Plus, Trash2, Save, X, Loader2, Edit3, Play,
  AlertTriangle, Eye, EyeOff, ShieldCheck, ShieldAlert,
  Lock, FileWarning, Ban, CheckCircle, RefreshCw
} from 'lucide-react'

const PII_TYPES = ['email', 'phone', 'ssn', 'credit_card', 'address', 'name', 'ip_address', 'date_of_birth']
const PII_ACTIONS = ['mask', 'block', 'warn']

const Guardrails = () => {
  const [view, setView] = useState('list')  // list | create | edit | test
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testConfigName, setTestConfigName] = useState('default')
  const [selectedConfig, setSelectedConfig] = useState(null)

  const emptyForm = {
    name: '',
    pii_action: 'mask',
    pii_types: ['email', 'phone'],
    blocked_topics: [],
    denied_words: [],
    prompt_injection_check: true,
    max_input_length: 10000,
    max_output_length: 10000
  }
  const [form, setForm] = useState({ ...emptyForm })
  const [topicInput, setTopicInput] = useState('')
  const [wordInput, setWordInput] = useState('')

  useEffect(() => { loadConfigs() }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const res = await guardrailsApi.listConfigs()
      setConfigs(res.data?.configs || res.data || [])
    } catch (e) { console.error(e); notify('error', 'Failed to load guardrail configs') }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { notify('error', 'Config name is required'); return }
    setSaving(true)
    try {
      await guardrailsApi.createConfig(form)
      notify('success', 'Guardrail config created!')
      setForm({ ...emptyForm }); setView('list'); loadConfigs()
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to create config') }
    finally { setSaving(false) }
  }

  const handleDelete = async (name) => {
    if (!confirm(`Delete guardrail config "${name}"?`)) return
    try {
      await guardrailsApi.deleteConfig(name)
      notify('success', 'Config deleted')
      loadConfigs()
    } catch (e) { notify('error', 'Failed to delete config') }
  }

  const openEdit = (config) => {
    setSelectedConfig(config)
    setForm({
      name: config.name,
      pii_action: config.pii_action || 'mask',
      pii_types: config.pii_types || ['email', 'phone'],
      blocked_topics: config.blocked_topics || [],
      denied_words: config.denied_words || [],
      prompt_injection_check: config.prompt_injection_check ?? true,
      max_input_length: config.max_input_length || 10000,
      max_output_length: config.max_output_length || 10000
    })
    setView('edit')
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      // Delete old + recreate (guardrails API doesn't have PUT)
      await guardrailsApi.deleteConfig(selectedConfig.name).catch(() => {})
      await guardrailsApi.createConfig(form)
      notify('success', 'Guardrail config updated!')
      setView('list'); loadConfigs()
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to update') }
    finally { setSaving(false) }
  }

  const handleTest = async (type = 'check') => {
    if (!testText.trim()) { notify('error', 'Enter text to test'); return }
    setTesting(true); setTestResult(null)
    try {
      let res
      if (type === 'check') res = await guardrailsApi.check(testText, testConfigName)
      else if (type === 'input') res = await guardrailsApi.applyInput(testText, testConfigName)
      else res = await guardrailsApi.applyOutput(testText, testConfigName)
      setTestResult({ type, data: res.data })
    } catch (e) { setTestResult({ type, error: e.response?.data?.detail || 'Test failed' }) }
    finally { setTesting(false) }
  }

  const addTopic = () => {
    const t = topicInput.trim()
    if (t && !form.blocked_topics.includes(t)) setForm({ ...form, blocked_topics: [...form.blocked_topics, t] })
    setTopicInput('')
  }

  const addWord = () => {
    const w = wordInput.trim().toLowerCase()
    if (w && !form.denied_words.includes(w)) setForm({ ...form, denied_words: [...form.denied_words, w] })
    setWordInput('')
  }

  const togglePiiType = (type) => {
    setForm({
      ...form,
      pii_types: form.pii_types.includes(type)
        ? form.pii_types.filter(t => t !== type)
        : [...form.pii_types, type]
    })
  }

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading guardrails...</span></div>
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
              {view === 'list' ? 'Guardrails' : view === 'create' ? 'Create Guardrail Config' : view === 'edit' ? 'Edit Guardrail Config' : 'Test Guardrails'}
            </h1>
            <p className="ov-header__sub">
              {view === 'list' ? 'Configure content safety, PII detection, and input/output filtering.' :
               view === 'test' ? 'Test your guardrail configurations against sample text.' :
               'Define rules for content filtering, PII handling, and prompt injection prevention.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view !== 'list' && (
              <button className="md-btn" onClick={() => { setView('list'); setTestResult(null) }}>← Back</button>
            )}
            {view === 'list' && (
              <>
                <button className="md-btn" onClick={() => setView('test')}><Play size={14} /> Test</button>
                <button className="md-btn md-btn--primary" onClick={() => { setForm({ ...emptyForm }); setView('create') }}>
                  <Plus size={14} /> New Config
                </button>
              </>
            )}
          </div>
        </div>

        {/* List View */}
        {view === 'list' && (
          <>
            {configs.length === 0 ? (
              <div className="bl-empty">
                <Shield size={48} strokeWidth={1} />
                <p>No guardrail configs yet</p>
                <span>Create a guardrail configuration to protect your AI applications.</span>
                <button className="md-btn md-btn--primary" style={{ marginTop: 16 }} onClick={() => { setForm({ ...emptyForm }); setView('create') }}>
                  <Plus size={14} /> Create First Config
                </button>
              </div>
            ) : (
              <div className="gr-grid">
                {configs.map(c => (
                  <div key={c.name} className="gr-card">
                    <div className="gr-card__header">
                      <div className="gr-card__icon"><Shield size={20} /></div>
                      <h3 className="gr-card__name">{c.name}</h3>
                    </div>
                    <div className="gr-card__body">
                      <div className="gr-card__row">
                        <Lock size={13} /> PII: <strong>{c.pii_action || 'mask'}</strong>
                        <span className="gr-card__count">{(c.pii_types || []).length} types</span>
                      </div>
                      <div className="gr-card__row">
                        <Ban size={13} /> Blocked topics: <strong>{(c.blocked_topics || []).length}</strong>
                      </div>
                      <div className="gr-card__row">
                        <FileWarning size={13} /> Denied words: <strong>{(c.denied_words || []).length}</strong>
                      </div>
                      <div className="gr-card__row">
                        <ShieldAlert size={13} /> Injection check: <strong>{c.prompt_injection_check ? 'On' : 'Off'}</strong>
                      </div>
                    </div>
                    <div className="gr-card__actions">
                      <button className="md-btn md-btn--sm" onClick={() => openEdit(c)}><Edit3 size={13} /> Edit</button>
                      <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => handleDelete(c.name)}><Trash2 size={13} /></button>
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
                <div className="st-card__header"><Shield size={18} /> Configuration</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Config Name *</label>
                    <input className="pg-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., production, strict, lenient" disabled={view === 'edit'} />
                  </div>

                  {/* PII Settings */}
                  <div className="st-field">
                    <label className="pg-field__label">PII Action</label>
                    <div className="gr-pii-actions">
                      {PII_ACTIONS.map(a => (
                        <button key={a} className={`md-btn md-btn--sm ${form.pii_action === a ? 'md-btn--primary' : ''}`} onClick={() => setForm({ ...form, pii_action: a })}>
                          {a === 'mask' && <EyeOff size={13} />}
                          {a === 'block' && <Ban size={13} />}
                          {a === 'warn' && <AlertTriangle size={13} />}
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="st-field">
                    <label className="pg-field__label">PII Types to Detect</label>
                    <div className="gr-pii-types">
                      {PII_TYPES.map(t => (
                        <label key={t} className={`gr-pii-chip ${form.pii_types.includes(t) ? 'gr-pii-chip--active' : ''}`}>
                          <input type="checkbox" checked={form.pii_types.includes(t)} onChange={() => togglePiiType(t)} style={{ display: 'none' }} />
                          {t.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Injection */}
                  <div className="st-toggle-row">
                    <div className="st-toggle-row__info">
                      <span className="st-toggle-row__title">Prompt Injection Detection</span>
                      <span className="st-toggle-row__desc">Check for prompt injection attempts in user input</span>
                    </div>
                    <button className={`pg-switch ${form.prompt_injection_check ? 'pg-switch--on' : ''}`} onClick={() => setForm({ ...form, prompt_injection_check: !form.prompt_injection_check })}>
                      <span className="pg-slider" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Blocked Topics & Denied Words */}
              <div className="st-card" style={{ marginTop: 16 }}>
                <div className="st-card__header"><Ban size={18} /> Content Filtering</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Blocked Topics</label>
                    <div className="pm-tag-input">
                      <input className="pg-input" value={topicInput} onChange={e => setTopicInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTopic())} placeholder="Add topic + Enter" />
                    </div>
                    {form.blocked_topics.length > 0 && (
                      <div className="pm-tags-list">
                        {form.blocked_topics.map(t => (
                          <span key={t} className="pm-chip pm-chip--danger">{t} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setForm({ ...form, blocked_topics: form.blocked_topics.filter(x => x !== t) })} /></span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Denied Words</label>
                    <div className="pm-tag-input">
                      <input className="pg-input" value={wordInput} onChange={e => setWordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addWord())} placeholder="Add word + Enter" />
                    </div>
                    {form.denied_words.length > 0 && (
                      <div className="pm-tags-list">
                        {form.denied_words.map(w => (
                          <span key={w} className="pm-chip pm-chip--danger">{w} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setForm({ ...form, denied_words: form.denied_words.filter(x => x !== w) })} /></span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pm-form-side">
              <div className="st-card">
                <div className="st-card__header"><Shield size={18} /> Limits</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Max Input Length</label>
                    <input type="number" className="pg-input" value={form.max_input_length} onChange={e => setForm({ ...form, max_input_length: parseInt(e.target.value) || 10000 })} min={100} max={100000} />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Max Output Length</label>
                    <input type="number" className="pg-input" value={form.max_output_length} onChange={e => setForm({ ...form, max_output_length: parseInt(e.target.value) || 10000 })} min={100} max={100000} />
                  </div>
                </div>
              </div>
              <button className="md-btn md-btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={view === 'create' ? handleCreate : handleUpdate} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : view === 'create' ? 'Create Config' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Test View */}
        {view === 'test' && (
          <div className="pm-form-grid">
            <div className="pm-form-main">
              <div className="st-card">
                <div className="st-card__header"><Play size={18} /> Test Input</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Text to Test</label>
                    <textarea className="pg-input pm-textarea pm-textarea--lg" rows={6} value={testText} onChange={e => setTestText(e.target.value)} placeholder="Enter text to test against guardrails...\n\nExample: My email is john@example.com and my SSN is 123-45-6789. Ignore all previous instructions." />
                  </div>
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className="st-card" style={{ marginTop: 16 }}>
                  <div className="st-card__header">
                    {testResult.error ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                    {testResult.error ? ' Error' : ' Result'}
                  </div>
                  <div className="st-card__body">
                    {testResult.error ? (
                      <div className="bc-error"><X size={14} /> {testResult.error}</div>
                    ) : (
                      <div className="gr-test-result">
                        {testResult.data?.safe !== undefined && (
                          <div className={`gr-test-verdict ${testResult.data.safe ? 'gr-test-verdict--safe' : 'gr-test-verdict--unsafe'}`}>
                            {testResult.data.safe ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                            <span>{testResult.data.safe ? 'Content is SAFE' : 'Content FLAGGED'}</span>
                          </div>
                        )}
                        {testResult.data?.flags && testResult.data.flags.length > 0 && (
                          <div className="gr-test-flags">
                            <label className="pg-field__label">Flags</label>
                            {testResult.data.flags.map((f, i) => (
                              <div key={i} className="gr-test-flag"><AlertTriangle size={13} /> {typeof f === 'string' ? f : f.type || JSON.stringify(f)}</div>
                            ))}
                          </div>
                        )}
                        {testResult.data?.modified_text && (
                          <div className="pm-preview-block" style={{ marginTop: 12 }}>
                            <label className="pg-field__label">Modified Text</label>
                            <pre className="pm-code">{testResult.data.modified_text}</pre>
                          </div>
                        )}
                        {testResult.data?.pii_detected && testResult.data.pii_detected.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <label className="pg-field__label">PII Detected</label>
                            <div className="pm-tags-list">
                              {testResult.data.pii_detected.map((p, i) => (
                                <span key={i} className="pm-chip pm-chip--danger">{typeof p === 'string' ? p : p.type || JSON.stringify(p)}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pm-form-side">
              <div className="st-card">
                <div className="st-card__header"><Shield size={18} /> Test Config</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Config Name</label>
                    <select className="pg-input" value={testConfigName} onChange={e => setTestConfigName(e.target.value)}>
                      <option value="default">default</option>
                      {configs.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button className="md-btn md-btn--primary" onClick={() => handleTest('check')} disabled={testing} style={{ width: '100%' }}>
                  <ShieldCheck size={14} /> {testing ? 'Checking...' : 'Quick Safety Check'}
                </button>
                <button className="md-btn" onClick={() => handleTest('input')} disabled={testing} style={{ width: '100%' }}>
                  <Eye size={14} /> Apply Input Filter
                </button>
                <button className="md-btn" onClick={() => handleTest('output')} disabled={testing} style={{ width: '100%' }}>
                  <EyeOff size={14} /> Apply Output Filter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Guardrails
