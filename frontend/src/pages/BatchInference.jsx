import './BatchInference.css'
import { useState, useEffect, useRef } from 'react'
import { batchApi } from '../api/platformServices'
import { modelsApi } from '../api/endpoints'
import { notify } from '../utils/notify'
import {
  Layers, Plus, Loader2, Play, X, Download, RefreshCw, Trash2,
  CheckCircle, Clock, AlertCircle, XCircle, ChevronDown, FileText,
  Upload, Copy, Eye
} from 'lucide-react'

const BatchInference = () => {
  const [view, setView] = useState('list')  // list | create | results
  const [jobs, setJobs] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [results, setResults] = useState(null)
  const [expandedJob, setExpandedJob] = useState(null)
  const pollRef = useRef(null)

  // Create form
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [requests, setRequests] = useState([{ id: 1, messages: [{ role: 'user', content: '' }] }])
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonInput, setJsonInput] = useState('')

  let nextReqId = useRef(2)

  useEffect(() => { loadData() }, [])
  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [jr, mr] = await Promise.all([batchApi.listJobs(), modelsApi.list()])
      setJobs(jr.data?.jobs || jr.data || [])
      setModels(mr.data?.models || mr.data || [])
    } catch (e) { console.error(e); notify('error', 'Failed to load batch jobs') }
    finally { setLoading(false) }
  }

  const refreshJobs = async () => {
    try {
      const res = await batchApi.listJobs()
      setJobs(res.data?.jobs || res.data || [])
    } catch (e) { console.error(e) }
  }

  const addRequest = () => {
    setRequests([...requests, { id: nextReqId.current++, messages: [{ role: 'user', content: '' }] }])
  }

  const removeRequest = (id) => {
    if (requests.length <= 1) return
    setRequests(requests.filter(r => r.id !== id))
  }

  const updateRequestMessage = (reqId, content) => {
    setRequests(requests.map(r => r.id === reqId ? { ...r, messages: [{ role: 'user', content }] } : r))
  }

  const handleCreate = async () => {
    if (!model) { notify('error', 'Select a model'); return }

    let batchRequests
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonInput)
        batchRequests = Array.isArray(parsed) ? parsed : [parsed]
      } catch (e) { notify('error', 'Invalid JSON input'); return }
    } else {
      batchRequests = requests
        .filter(r => r.messages[0]?.content.trim())
        .map(r => ({ messages: r.messages }))
      if (batchRequests.length === 0) { notify('error', 'Add at least one request with content'); return }
    }

    setCreating(true)
    try {
      await batchApi.createJob({ model, requests: batchRequests, temperature, max_tokens: maxTokens })
      notify('success', `Batch job created with ${batchRequests.length} requests!`)
      setView('list'); loadData()
      setRequests([{ id: 1, messages: [{ role: 'user', content: '' }] }])
      setJsonInput(''); nextReqId.current = 2
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to create batch job') }
    finally { setCreating(false) }
  }

  const viewResults = async (job) => {
    setSelectedJob(job)
    try {
      const res = await batchApi.getResults(job.job_id || job.id)
      setResults(res.data?.results || res.data || [])
      setView('results')
    } catch (e) { notify('error', 'Failed to load results'); setResults([]) ; setView('results') }
  }

  const cancelJob = async (jobId) => {
    try {
      await batchApi.cancelJob(jobId)
      notify('success', 'Job cancelled')
      refreshJobs()
    } catch (e) { notify('error', 'Failed to cancel job') }
  }

  const statusIcon = (s) => {
    switch (s) {
      case 'completed': return <CheckCircle size={14} className="ix-text--green" />
      case 'processing': case 'running': return <Loader2 size={14} className="animate-spin" />
      case 'pending': case 'queued': return <Clock size={14} />
      case 'failed': return <XCircle size={14} className="ix-text--red" />
      case 'cancelled': return <XCircle size={14} />
      default: return <Clock size={14} />
    }
  }

  const statusClass = (s) => {
    if (s === 'completed') return 'paid'
    if (s === 'processing' || s === 'running') return 'pending'
    if (s === 'failed') return 'failed'
    return 'info'
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading batch jobs...</span></div>
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
              {view === 'list' ? 'Batch Inference' : view === 'create' ? 'Create Batch Job' : 'Batch Results'}
            </h1>
            <p className="ov-header__sub">
              {view === 'list' ? 'Run multiple prompts in a single batch for efficient processing.' :
               view === 'create' ? 'Add multiple requests to process as a batch (max 100).' :
               `Results for job: ${selectedJob?.job_id || selectedJob?.id || ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {view !== 'list' && (
              <button className="md-btn" onClick={() => { setView('list'); setResults(null) }}>← Back</button>
            )}
            {view === 'list' && (
              <>
                <button className="md-btn" onClick={refreshJobs}><RefreshCw size={14} /> Refresh</button>
                <button className="md-btn md-btn--primary" onClick={() => setView('create')}><Plus size={14} /> New Batch</button>
              </>
            )}
          </div>
        </div>

        {/* List View */}
        {view === 'list' && (
          <div className="ix-table-card">
            <div className="ix-table-card__header"><h3>Batch Jobs</h3></div>
            {jobs.length === 0 ? (
              <div className="bl-empty">
                <Layers size={48} strokeWidth={1} />
                <p>No batch jobs yet</p>
                <span>Create a batch to process multiple requests at once.</span>
                <button className="md-btn md-btn--primary" style={{ marginTop: 16 }} onClick={() => setView('create')}>
                  <Plus size={14} /> Create First Batch
                </button>
              </div>
            ) : (
              <div className="ix-table-wrap">
                <table className="ix-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Model</th>
                      <th>Requests</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr key={j.job_id || j.id}>
                        <td><code style={{ fontSize: 12 }}>{(j.job_id || j.id || '').slice(0, 12)}...</code></td>
                        <td>{j.model}</td>
                        <td>{j.total_requests ?? j.request_count ?? '—'}</td>
                        <td>
                          <span className={`ix-badge ix-badge--${statusClass(j.status)}`}>
                            {statusIcon(j.status)} {j.status}
                          </span>
                        </td>
                        <td>{formatDate(j.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {j.status === 'completed' && (
                              <button className="md-btn md-btn--sm" onClick={() => viewResults(j)}><Eye size={13} /> Results</button>
                            )}
                            {(j.status === 'processing' || j.status === 'pending' || j.status === 'queued') && (
                              <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => cancelJob(j.job_id || j.id)}><X size={13} /> Cancel</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create View */}
        {view === 'create' && (
          <div className="pm-form-grid">
            <div className="pm-form-main">
              <div className="st-card">
                <div className="st-card__header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={18} /> Requests
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`md-btn md-btn--sm ${!jsonMode ? 'md-btn--primary' : ''}`} onClick={() => setJsonMode(false)}>Visual</button>
                    <button className={`md-btn md-btn--sm ${jsonMode ? 'md-btn--primary' : ''}`} onClick={() => setJsonMode(true)}>JSON</button>
                  </div>
                </div>
                <div className="st-card__body">
                  {jsonMode ? (
                    <div className="st-field">
                      <label className="pg-field__label">JSON Array of Requests</label>
                      <textarea
                        className="pg-input pm-textarea pm-textarea--lg"
                        rows={12}
                        value={jsonInput}
                        onChange={e => setJsonInput(e.target.value)}
                        placeholder={'[\n  { "messages": [{ "role": "user", "content": "What is AI?" }] },\n  { "messages": [{ "role": "user", "content": "Explain ML" }] }\n]'}
                        style={{ fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>
                  ) : (
                    <>
                      {requests.map((req, i) => (
                        <div key={req.id} className="ba-request-item">
                          <div className="ba-request-item__header">
                            <span className="ba-request-item__num">#{i + 1}</span>
                            {requests.length > 1 && (
                              <button className="md-btn md-btn--sm md-btn--danger-text" onClick={() => removeRequest(req.id)}><X size={13} /></button>
                            )}
                          </div>
                          <textarea
                            className="pg-input"
                            rows={2}
                            value={req.messages[0]?.content || ''}
                            onChange={e => updateRequestMessage(req.id, e.target.value)}
                            placeholder={`Enter prompt for request #${i + 1}...`}
                          />
                        </div>
                      ))}
                      <button className="md-btn md-btn--sm" onClick={addRequest} style={{ marginTop: 8 }}>
                        <Plus size={14} /> Add Request
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pm-form-side">
              <div className="st-card">
                <div className="st-card__header"><Layers size={18} /> Configuration</div>
                <div className="st-card__body">
                  <div className="st-field">
                    <label className="pg-field__label">Model *</label>
                    <select className="pg-input" value={model} onChange={e => setModel(e.target.value)}>
                      <option value="">Select model...</option>
                      {models.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                    </select>
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Temperature: {temperature}</label>
                    <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="pg-range" />
                  </div>
                  <div className="st-field">
                    <label className="pg-field__label">Max Tokens</label>
                    <input type="number" className="pg-input" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 1024)} min={1} max={32000} />
                  </div>
                </div>
              </div>
              <button className="md-btn md-btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={handleCreate} disabled={creating}>
                <Play size={14} /> {creating ? 'Creating...' : `Create Batch (${jsonMode ? 'JSON' : requests.filter(r => r.messages[0]?.content.trim()).length} requests)`}
              </button>
            </div>
          </div>
        )}

        {/* Results View */}
        {view === 'results' && (
          <div className="ix-table-card">
            <div className="ix-table-card__header">
              <h3>Results ({Array.isArray(results) ? results.length : 0} responses)</h3>
            </div>
            {(!results || (Array.isArray(results) && results.length === 0)) ? (
              <div className="bl-empty">
                <FileText size={40} strokeWidth={1} />
                <p>No results available</p>
                <span>Results may not be ready yet or the job had no output.</span>
              </div>
            ) : (
              <div className="ba-results-list">
                {(Array.isArray(results) ? results : [results]).map((r, i) => (
                  <div key={i} className="ba-result-card">
                    <div className="ba-result-card__header">
                      <span className="ba-request-item__num">#{i + 1}</span>
                      {r.status && <span className={`ix-badge ix-badge--${r.status === 'success' ? 'paid' : 'failed'}`}>{r.status}</span>}
                    </div>
                    {r.request && (
                      <div className="ba-result-card__section">
                        <label className="pg-field__label">Prompt</label>
                        <p className="ba-result-card__text">{r.request?.messages?.[0]?.content || JSON.stringify(r.request)}</p>
                      </div>
                    )}
                    <div className="ba-result-card__section">
                      <label className="pg-field__label">Response</label>
                      <p className="ba-result-card__text">{r.response?.content || r.content || r.error || JSON.stringify(r.response || r)}</p>
                    </div>
                    {r.usage && (
                      <div className="ba-result-card__meta">
                        {r.usage.total_tokens && <span>Tokens: {r.usage.total_tokens}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BatchInference
