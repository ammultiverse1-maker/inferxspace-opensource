import './RequestLogs.css'
import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronRight, Loader2, Clock, Cpu, Coins, Activity, AlertTriangle } from 'lucide-react'
import { usageApi } from '../api/endpoints'

const RequestLogs = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRows, setExpandedRows] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => { fetchLogs() }, [page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await usageApi.getLogs(page, 50)
      const newLogs = (response.data.logs || []).map(log => {
        const totalCost = parseFloat(log.total_cost) || 0
        let costDisplay = totalCost === 0 ? '₹0.00' : totalCost < 0.0001 ? `₹${totalCost.toFixed(6)}` : totalCost < 0.01 ? `₹${totalCost.toFixed(4)}` : `₹${totalCost.toFixed(2)}`
        return {
          id: log.id,
          timestamp: new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
          model: getModelName(log.model_id),
          tokens: (log.total_tokens || 0).toLocaleString(),
          latency: log.latency_ms ? `${(log.latency_ms / 1000).toFixed(1)}s` : '—',
          cost: costDisplay,
          status: log.status === 'success' ? 'success' : 'error',
          details: {
            input: `${log.input_tokens || 0} tokens`,
            output: `${log.output_tokens || 0} tokens`,
            cost: costDisplay,
            status: log.status === 'success' ? '✓ Success' : `✗ ${log.error_message || 'Error'}`
          }
        }
      })
      if (page === 1) setLogs(newLogs); else setLogs(prev => [...prev, ...newLogs])
      setTotalPages(Math.ceil((response.data.total || 0) / 50))
      setHasMore(newLogs.length === 50)
    } catch (error) { setLogs([]) }
    finally { setLoading(false) }
  }

  const getModelName = (modelId) => {
    const n = { "llama-3.1-8b-instruct": "Llama 3.1 8B", "llama-3.1-70b-instruct": "Llama 3.1 70B", "mistral-7b-instruct": "Mistral 7B", "mixtral-8x7b-instruct": "Mixtral 8x7B", "qwen-2.5-7b-instruct": "Qwen 2.5 7B", "bge-large-en-v1.5": "BGE Large", "apertus-8b": "Apertus 8B", "llama3.2:1b": "Llama 3.2 1B" }
    return n[modelId] || modelId
  }

  const toggleRow = (id) => setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.model.toLowerCase().includes(searchTerm.toLowerCase()) || log.timestamp.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading && logs.length === 0) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading logs...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Request Logs</h1>
            <p className="ov-header__sub">Detailed request history with expandable details.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="md-filters">
          <div className="md-search">
            <Search size={16} />
            <input type="text" placeholder="Search by model, date..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="md-categories">
            {['all', 'success', 'error'].map(s => (
              <button key={s} className={`md-cat-btn ${statusFilter === s ? 'md-cat-btn--active' : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All Status' : s === 'success' ? '✓ Success' : '✗ Error'}
              </button>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="rl-log-list">
          {filteredLogs.length === 0 ? (
            <div className="ov-empty-state" style={{ marginTop: 40 }}>
              <Activity size={24} /><span>No logs found</span>
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className={`rl-log ${expandedRows.includes(log.id) ? 'rl-log--open' : ''} ${log.status === 'error' ? 'rl-log--error' : ''}`}>
                <div className="rl-log__row" onClick={() => toggleRow(log.id)}>
                  <div className="rl-log__cell rl-log__cell--status">
                    <span className={`ix-badge ix-badge--${log.status === 'success' ? 'paid' : 'failed'}`}>
                      {log.status === 'success' ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="rl-log__cell rl-log__cell--time">
                    <Clock size={13} /> {log.timestamp}
                  </div>
                  <div className="rl-log__cell rl-log__cell--model">
                    <Cpu size={13} /> {log.model}
                  </div>
                  <div className="rl-log__cell">{log.tokens} tok</div>
                  <div className={`rl-log__cell rl-log__cell--latency ${log.status === 'error' ? 'ix-text--red' : parseFloat(log.latency) < 1 ? 'ix-text--green' : ''}`}>
                    {log.latency}
                  </div>
                  <div className="rl-log__cell">{log.cost}</div>
                  <div className="rl-log__cell rl-log__cell--expand">
                    {expandedRows.includes(log.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </div>
                {expandedRows.includes(log.id) && (
                  <div className="rl-log__details">
                    <div className="rl-detail"><span>Input</span><span>{log.details.input}</span></div>
                    <div className="rl-detail"><span>Output</span><span>{log.details.output}</span></div>
                    <div className="rl-detail"><span>Cost</span><span>{log.details.cost}</span></div>
                    <div className="rl-detail"><span>Status</span><span className={log.status === 'error' ? 'ix-text--red' : 'ix-text--green'}>{log.details.status}</span></div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="rl-footer">
            {hasMore && (
              <button className="md-btn md-btn--primary" onClick={() => setPage(p => p + 1)} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={14} /> : 'Load More'}
              </button>
            )}
            <span className="rl-footer__info">Page {page} of {totalPages}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default RequestLogs
