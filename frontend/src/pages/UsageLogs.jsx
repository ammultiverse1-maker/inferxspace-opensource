import { useState, useEffect } from 'react'
import { ChevronDown, Download, Loader2, BarChart3, PieChart as PieIcon, Table } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { usageApi } from '../api/endpoints'
import api from '../api/client'
import { notify } from '../utils/notify'

const UsageLogs = () => {
  const [dateRange, setDateRange] = useState('Last 7 Days')
  const [selectedModel, setSelectedModel] = useState('All Models')
  const [loading, setLoading] = useState(true)
  const [requestsData, setRequestsData] = useState([])
  const [tokenUsageData, setTokenUsageData] = useState([])
  const [costData, setCostData] = useState([])
  const [totals, setTotals] = useState({ requests: 0, tokens: 0, cost: 0 })

  useEffect(() => { fetchData() }, [dateRange, selectedModel])

  const fetchData = async () => {
    try {
      setLoading(true)
      const now = new Date()
      let startDate = null
      let endDate = now.toISOString().split('T')[0]
      if (dateRange === 'Last 7 Days') {
        const d = new Date(now); d.setDate(now.getDate() - 7); startDate = d.toISOString().split('T')[0]
      } else if (dateRange === 'Last 30 Days') {
        const d = new Date(now); d.setDate(now.getDate() - 30); startDate = d.toISOString().split('T')[0]
      }

      try {
        const chartUrl = startDate
          ? `/api/usage/chart?metric=requests&interval=day&start_date=${startDate}&end_date=${endDate}${selectedModel !== 'All Models' ? `&model_id=${selectedModel}` : ''}`
          : `/api/usage/chart?metric=requests&interval=day${selectedModel !== 'All Models' ? `&model_id=${selectedModel}` : ''}`
        const chartRes = await api.get(chartUrl)
        setRequestsData(chartRes.data.data.map(item => ({ day: new Date(item.label).getDate(), date: item.label, value: item.value })))
      } catch (e) { setRequestsData([]) }

      try {
        const breakdownUrl = startDate
          ? `/api/usage/breakdown?start_date=${startDate}&end_date=${endDate}${selectedModel !== 'All Models' ? `&model_id=${selectedModel}` : ''}`
          : `/api/usage/breakdown${selectedModel !== 'All Models' ? `?model_id=${selectedModel}` : ''}`
        const breakdownRes = await api.get(breakdownUrl)
        const breakdownArray = breakdownRes.data.by_model || []

        const costDataArray = breakdownArray.map(item => {
          const totalTokens = item.total_input_tokens + item.total_output_tokens
          const totalCost = parseFloat(item.total_cost) || 0
          let costDisplay = totalCost === 0 ? '₹0.00' : totalCost < 0.0001 ? `₹${totalCost.toFixed(6)}` : totalCost < 0.01 ? `₹${totalCost.toFixed(4)}` : `₹${totalCost.toFixed(2)}`
          return { model: item.model_name || item.model_id, requests: item.total_requests.toLocaleString(), tokens: `${(totalTokens / 1000).toFixed(1)}K`, cost: costDisplay, rawTokens: totalTokens, rawCost: totalCost, rawRequests: item.total_requests }
        })
        setCostData(costDataArray)

        const totalReq = breakdownArray.reduce((a, i) => a + (i.total_requests || 0), 0)
        const totalTok = breakdownArray.reduce((a, i) => a + (i.total_input_tokens + i.total_output_tokens), 0)
        const totalCst = breakdownArray.reduce((a, i) => a + (parseFloat(i.total_cost) || 0), 0)
        setTotals({
          requests: totalReq.toLocaleString(),
          tokens: `${(totalTok / 1000).toFixed(1)}K`,
          cost: totalCst < 0.0001 ? `₹${totalCst.toFixed(6)}` : totalCst < 0.01 ? `₹${totalCst.toFixed(4)}` : `₹${totalCst.toFixed(2)}`
        })

        const COLORS = ['var(--primary)', 'var(--brand-green)', 'var(--secondary)', 'var(--success)', 'var(--warning)']
        setTokenUsageData(breakdownArray.map((item, i) => ({
          name: item.model_name || item.model_id,
          value: item.total_input_tokens + item.total_output_tokens,
          color: COLORS[i % COLORS.length]
        })).filter(item => item.value > 0))
      } catch (e) { console.error("Breakdown error", e) }
    } catch (err) { console.error('Failed:', err) }
    finally { setLoading(false) }
  }

  const exportToCSV = async () => {
    try {
      const now = new Date()
      let startDate = null; let endDate = now.toISOString().split('T')[0]
      if (dateRange === 'Last 7 Days') { const d = new Date(now); d.setDate(now.getDate() - 7); startDate = d.toISOString().split('T')[0] }
      else if (dateRange === 'Last 30 Days') { const d = new Date(now); d.setDate(now.getDate() - 30); startDate = d.toISOString().split('T')[0] }
      let exportUrl = '/api/usage/export/csv'
      const params = []
      if (startDate) { params.push(`start_date=${startDate}`); params.push(`end_date=${endDate}`) }
      if (selectedModel !== 'All Models') params.push(`model_id=${selectedModel}`)
      if (params.length > 0) exportUrl += '?' + params.join('&')
      const response = await api.get(exportUrl, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      let filename = `usage_export_${dateRange.toLowerCase().replace(' ', '_')}`
      if (selectedModel !== 'All Models') filename += `_${selectedModel.replace(' ', '_').toLowerCase()}`
      link.setAttribute('download', filename + '.csv')
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) { notify('error', 'Failed to export CSV.') }
  }

  if (loading && requestsData.length === 0) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading analytics...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Usage & Analytics</h1>
            <p className="ov-header__sub">Monitor your API usage, token consumption, and costs.</p>
          </div>
          <div className="ov-header__actions">
            <button className="ov-action-btn" onClick={exportToCSV}><Download size={15} /> Export CSV</button>
          </div>
        </div>

        {/* Filters */}
        <div className="md-filters" style={{ marginBottom: 20 }}>
          <div className="md-categories">
            <div className="ix-filter-group">
              <label>Date Range</label>
              <select className="ix-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            <div className="ix-filter-group">
              <label>Model</label>
              <select className="ix-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                <option>All Models</option>
                <option value="llama3.2:1b">Llama 3.2 1B</option>
                <option value="mistral:7b">Mistral 7B</option>
                <option value="llama-3.1-8b-instruct">Llama 3.1 8B Instruct</option>
                <option value="llama-3.1-70b-instruct">Llama 3.1 70B Instruct</option>
                <option value="qwen-2.5-7b-instruct">Qwen 2.5 7B Instruct</option>
              </select>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="ov-bottom-grid">
          <div className="ov-card ov-card--chart">
            <div className="ov-card__header"><h3>Requests Over Time</h3></div>
            <div className="ov-card__body" style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={requestsData}>
                  <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{ fill: 'color-mix(in srgb, var(--primary) 4%, transparent)' }}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="ov-card ov-card--chart">
            <div className="ov-card__header"><h3>Token Usage by Model</h3></div>
            <div className="ov-card__body" style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {tokenUsageData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={tokenUsageData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                      {tokenUsageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="ov-empty-state"><PieIcon size={24} /><span>No token usage yet</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="ix-table-card">
          <div className="ix-table-card__header"><h3>Cost Breakdown</h3></div>
          <div className="ix-table-wrap">
            <table className="ix-table">
              <thead>
                <tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost (₹)</th></tr>
              </thead>
              <tbody>
                {costData.length > 0 ? costData.map((row, i) => (
                  <tr key={i}><td>{row.model}</td><td>{row.requests}</td><td>{row.tokens}</td><td>{row.cost}</td></tr>
                )) : (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No usage data found</td></tr>
                )}
                <tr className="ix-table__total">
                  <td><strong>Total</strong></td><td><strong>{totals.requests}</strong></td><td><strong>{totals.tokens}</strong></td><td><strong>{totals.cost}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsageLogs
