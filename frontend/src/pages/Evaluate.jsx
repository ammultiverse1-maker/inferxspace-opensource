import './Evaluate.css'
import { useState, useEffect } from 'react'
import { evaluateApi } from '../api/platformServices'
import { modelsApi } from '../api/endpoints'
import { notify } from '../utils/notify'
import MarkdownContent from '../components/MarkdownContent'
import {
  GitCompareArrows, Play, Loader2, Plus, X, Clock, Sparkles,
  BarChart3, RefreshCw, ChevronDown, Zap, DollarSign, Hash
} from 'lucide-react'

const Evaluate = () => {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [results, setResults] = useState(null)

  // Form
  const [selectedModels, setSelectedModels] = useState(['', ''])
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mr, hr] = await Promise.all([modelsApi.list(), evaluateApi.history().catch(() => ({ data: [] }))])
      setModels(mr.data?.models || mr.data || [])
      setHistory(hr.data?.evaluations || hr.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const addModel = () => {
    if (selectedModels.length >= 5) { notify('error', 'Maximum 5 models'); return }
    setSelectedModels([...selectedModels, ''])
  }

  const removeModel = (idx) => {
    if (selectedModels.length <= 2) return
    setSelectedModels(selectedModels.filter((_, i) => i !== idx))
  }

  const updateModel = (idx, val) => {
    const updated = [...selectedModels]
    updated[idx] = val
    setSelectedModels(updated)
  }

  const handleRun = async () => {
    const validModels = selectedModels.filter(m => m.trim())
    if (validModels.length < 2) { notify('error', 'Select at least 2 models'); return }
    if (!prompt.trim()) { notify('error', 'Enter a prompt'); return }

    setRunning(true); setResults(null)
    try {
      const messages = []
      if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt })
      messages.push({ role: 'user', content: prompt })

      const res = await evaluateApi.evaluate({
        models: validModels, messages, temperature, max_tokens: maxTokens
      })
      setResults(res.data)
    } catch (e) { notify('error', e.response?.data?.detail || 'Evaluation failed') }
    finally { setRunning(false) }
  }

  const formatLatency = (ms) => {
    if (!ms) return '—'
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
  }

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Model Evaluation</h1>
            <p className="ov-header__sub">Compare model responses side-by-side. Send the same prompt to multiple models and evaluate quality, speed, and cost.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {history.length > 0 && (
              <button className="md-btn" onClick={() => setShowHistory(!showHistory)}>
                <Clock size={14} /> History ({history.length})
              </button>
            )}
          </div>
        </div>

        {/* Configuration */}
        <div className="ev-config">
          <div className="st-card">
            <div className="st-card__header"><GitCompareArrows size={18} /> Evaluation Setup</div>
            <div className="st-card__body">
              {/* Model Selection */}
              <div className="st-field">
                <label className="pg-field__label">Models to Compare (2–5)</label>
                <div className="ev-model-list">
                  {selectedModels.map((m, i) => (
                    <div key={i} className="ev-model-row">
                      <span className="ev-model-row__label">Model {i + 1}</span>
                      <select className="pg-input" style={{ flex: 1 }} value={m} onChange={e => updateModel(i, e.target.value)}>
                        <option value="">Select model...</option>
                        {models.map(md => (
                          <option key={md.id} value={md.id} disabled={selectedModels.includes(md.id) && m !== md.id}>
                            {md.name || md.id}
                          </option>
                        ))}
                      </select>
                      {selectedModels.length > 2 && (
                        <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => removeModel(i)}><X size={13} /></button>
                      )}
                    </div>
                  ))}
                  {selectedModels.length < 5 && (
                    <button className="md-btn md-btn--sm" onClick={addModel}><Plus size={13} /> Add Model</button>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div className="st-field">
                <label className="pg-field__label">System Prompt (optional)</label>
                <textarea className="pg-input" rows={2} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="Optional system instructions..." />
              </div>
              <div className="st-field">
                <label className="pg-field__label">Prompt *</label>
                <textarea className="pg-input pm-textarea" rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Enter the prompt to send to all models..." />
              </div>

              {/* Params Row */}
              <div className="ev-params-row">
                <div className="st-field" style={{ flex: 1 }}>
                  <label className="pg-field__label">Temperature: {temperature}</label>
                  <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="pg-range" />
                </div>
                <div className="st-field" style={{ flex: 1 }}>
                  <label className="pg-field__label">Max Tokens</label>
                  <input type="number" className="pg-input" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 1024)} min={1} max={32000} />
                </div>
              </div>

              <button className="md-btn md-btn--primary" onClick={handleRun} disabled={running} style={{ marginTop: 8 }}>
                {running ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : <><Play size={14} /> Run Evaluation</>}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {running && (
          <div className="ev-running">
            <Loader2 size={32} className="animate-spin" />
            <p>Sending prompt to {selectedModels.filter(m => m).length} models...</p>
            <span>This may take a moment depending on model response times.</span>
          </div>
        )}

        {results && (
          <div className="ev-results">
            <h2 className="ev-results__title"><Sparkles size={20} /> Comparison Results</h2>

            {/* Summary bar */}
            {results.summary && (
              <div className="ev-summary">
                {results.summary.fastest && <div className="ev-summary__item"><Zap size={14} /> Fastest: <strong>{results.summary.fastest}</strong></div>}
                {results.summary.cheapest && <div className="ev-summary__item"><DollarSign size={14} /> Cheapest: <strong>{results.summary.cheapest}</strong></div>}
                {results.summary.most_tokens && <div className="ev-summary__item"><Hash size={14} /> Most detailed: <strong>{results.summary.most_tokens}</strong></div>}
              </div>
            )}

            {/* Side-by-side cards */}
            <div className="ev-cards-grid" style={{ gridTemplateColumns: `repeat(${Math.min((results.results || results.responses || []).length, 3)}, 1fr)` }}>
              {(results.results || results.responses || []).map((r, i) => (
                <div key={i} className="ev-result-card">
                  <div className="ev-result-card__header">
                    <h3>{r.model}</h3>
                    {r.latency_ms && <span className="ev-result-card__latency"><Clock size={12} /> {formatLatency(r.latency_ms)}</span>}
                  </div>
                  <div className="ev-result-card__body">
                    {r.error ? (
                      <div className="bc-error"><X size={14} /> {r.error}</div>
                    ) : (
                      <div className="ev-result-card__text">
                        <MarkdownContent content={r.response || r.content || r.choices?.[0]?.message?.content || JSON.stringify(r)} />
                      </div>
                    )}
                  </div>
                  <div className="ev-result-card__footer">
                    {r.usage && (
                      <>
                        <span>In: {r.usage.prompt_tokens || '—'}</span>
                        <span>Out: {r.usage.completion_tokens || '—'}</span>
                        <span>Total: {r.usage.total_tokens || '—'}</span>
                      </>
                    )}
                    {r.cost !== undefined && <span className="ev-result-card__cost">₹{Number(r.cost).toFixed(4)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div className="pg-modal-overlay" onClick={() => setShowHistory(false)}>
            <div className="ix-modal ix-modal--lg" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Evaluation History</h3><button onClick={() => setShowHistory(false)}><X size={18} /></button></div>
              <div className="ix-modal__body" style={{ maxHeight: 500, overflow: 'auto' }}>
                {history.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 32 }}>No evaluations yet.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="ev-history-item">
                      <div className="ev-history-item__header">
                        <span>{h.models?.join(' vs ') || '—'}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{h.prompt || h.messages?.[h.messages.length - 1]?.content || '—'}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="ix-modal__footer"><button className="md-btn md-btn--primary" onClick={() => setShowHistory(false)}>Close</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Evaluate
