import './Billing.css'
import { useState, useEffect } from 'react'
import { creditsApi, pricingApi } from '../api/endpoints'
import { notify } from '../utils/notify'
import {
  Check, X, CheckCircle, CreditCard,
  TrendingDown, Wallet, FileText, Loader2, RefreshCw, ArrowUpRight,
  ArrowDownRight, ChevronLeft, ChevronRight, Zap, Clock
} from 'lucide-react'

const Billing = () => {
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(null)
  const [walletInfo, setWalletInfo] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [purchases, setPurchases] = useState([])
  const [txnPage, setTxnPage] = useState(1)
  const [txnTotal, setTxnTotal] = useState(0)
  const [purPage, setPurPage] = useState(1)
  const [purTotal, setPurTotal] = useState(0)
  const [txnFilter, setTxnFilter] = useState('')
  const [activeTab, setActiveTab] = useState('transactions')

  const PER_PAGE = 15

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadTransactions() }, [txnPage, txnFilter])
  useEffect(() => { loadPurchases() }, [purPage])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadBalance(), loadTransactions(), loadPurchases(), loadWallet()])
    } catch (e) { console.error('Failed to load billing:', e) }
    finally { setLoading(false) }
  }

  const loadBalance = async () => {
    try {
      const res = await creditsApi.getBalance()
      setBalance(res.data)
    } catch (e) { console.error(e) }
  }

  const loadWallet = async () => {
    try {
      const res = await pricingApi.getWallet()
      setWalletInfo(res.data)
    } catch (e) { console.warn('Wallet info unavailable:', e) }
  }

  const loadTransactions = async () => {
    try {
      const res = await creditsApi.getTransactions(txnPage, PER_PAGE, txnFilter || undefined)
      setTransactions(res.data.transactions || [])
      setTxnTotal(res.data.total || 0)
    } catch (e) { console.error(e) }
  }

  const loadPurchases = async () => {
    try {
      const res = await creditsApi.getPurchases(purPage, PER_PAGE)
      setPurchases(res.data.purchases || [])
      setPurTotal(res.data.total || 0)
    } catch (e) { console.error(e) }
  }

  const formatTokens = (n) => {
    if (!n && n !== 0) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toLocaleString()
  }

  const formatDate = (d) => {
    if (!d) return '—'
    const date = new Date(d)
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatINR = (v) => {
    if (!v && v !== 0) return '₹0'
    return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  const txnTypeLabel = (t) => {
    const labels = { purchase: 'Purchase', usage: 'Usage', refund: 'Refund', adjustment: 'Adjustment' }
    return labels[t] || t
  }

  const txnTypeIcon = (t) => {
    if (t === 'purchase' || t === 'adjustment') return <ArrowUpRight size={14} />
    return <ArrowDownRight size={14} />
  }

  const txnMaxPages = Math.max(1, Math.ceil(txnTotal / PER_PAGE))
  const purMaxPages = Math.max(1, Math.ceil(purTotal / PER_PAGE))

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading billing data...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Billing & Transactions</h1>
            <p className="ov-header__sub">View your credit balance, transactions, and purchase history.</p>
          </div>
          <button className="md-btn" onClick={loadAll}><RefreshCw size={14} /> Refresh</button>
        </div>

        {/* Tier Banner */}
        {walletInfo && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            background: walletInfo.tier === 'paid'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08))'
              : 'linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.08))',
            border: walletInfo.tier === 'paid'
              ? '1px solid rgba(16, 185, 129, 0.2)'
              : '1px solid rgba(251, 191, 36, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {walletInfo.tier === 'paid' ? (
              <>
                <Zap size={18} style={{ color: '#10b981' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Pro Tier Active</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Full speed API access with billed keys. No artificial delays.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock size={18} style={{ color: '#f59e0b' }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Free Tier</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Shared API keys with 3-5s response delay. Deposit money to unlock Pro speed.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="ov-stats">
          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--purple"><Wallet size={20} /></div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Current Balance</span>
              <span className="ov-stat-card__value">{formatTokens(balance?.available_tokens || 0)} <small>tokens</small></span>
            </div>
          </div>
          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--green"><CreditCard size={20} /></div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Total Purchased</span>
              <span className="ov-stat-card__value">{formatTokens(balance?.total_purchased || 0)} <small>tokens</small></span>
            </div>
          </div>
          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--pink"><TrendingDown size={20} /></div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Total Used</span>
              <span className="ov-stat-card__value">{formatTokens(balance?.total_used || 0)} <small>tokens</small></span>
            </div>
          </div>
          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--orange"><FileText size={20} /></div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">INR Equivalent</span>
              <span className="ov-stat-card__value">{formatINR(balance?.balance_inr_equivalent || 0)}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bl-tabs">
          <button className={`bl-tab ${activeTab === 'transactions' ? 'bl-tab--active' : ''}`} onClick={() => setActiveTab('transactions')}>
            Transactions <span className="bl-tab__count">{txnTotal}</span>
          </button>
          <button className={`bl-tab ${activeTab === 'purchases' ? 'bl-tab--active' : ''}`} onClick={() => setActiveTab('purchases')}>
            Purchase History <span className="bl-tab__count">{purTotal}</span>
          </button>
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="ix-table-card">
            <div className="ix-table-card__header">
              <h3>Credit Transactions</h3>
              <select className="ix-select" value={txnFilter} onChange={(e) => { setTxnFilter(e.target.value); setTxnPage(1) }}>
                <option value="">All Types</option>
                <option value="purchase">Purchase</option>
                <option value="usage">Usage</option>
                <option value="refund">Refund</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            {transactions.length === 0 ? (
              <div className="bl-empty">
                <FileText size={40} strokeWidth={1} />
                <p>No transactions yet</p>
                <span>Your credit transactions will appear here.</span>
              </div>
            ) : (
              <>
                <div className="ix-table-wrap">
                  <table className="ix-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Tokens</th>
                        <th>Before</th>
                        <th>After</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td>{formatDate(t.created_at)}</td>
                          <td>
                            <span className={`ix-badge ix-badge--${t.transaction_type === 'purchase' ? 'paid' : t.transaction_type === 'refund' ? 'done' : t.transaction_type === 'usage' ? 'usage' : 'info'}`}>
                              {txnTypeIcon(t.transaction_type)}
                              {txnTypeLabel(t.transaction_type)}
                            </span>
                          </td>
                          <td className={t.amount_tokens >= 0 ? 'ix-text--green' : 'ix-text--red'}>
                            {t.amount_tokens >= 0 ? '+' : ''}{formatTokens(t.amount_tokens)}
                          </td>
                          <td>{formatTokens(t.balance_before)}</td>
                          <td>{formatTokens(t.balance_after)}</td>
                          <td className="bl-desc">{t.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {txnMaxPages > 1 && (
                  <div className="bl-pagination">
                    <button className="md-btn" disabled={txnPage <= 1} onClick={() => setTxnPage(txnPage - 1)}><ChevronLeft size={14} /></button>
                    <span className="bl-pagination__info">Page {txnPage} of {txnMaxPages}</span>
                    <button className="md-btn" disabled={txnPage >= txnMaxPages} onClick={() => setTxnPage(txnPage + 1)}><ChevronRight size={14} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <div className="ix-table-card">
            <div className="ix-table-card__header">
              <h3>Purchase History</h3>
            </div>
            {purchases.length === 0 ? (
              <div className="bl-empty">
                <CreditCard size={40} strokeWidth={1} />
                <p>No purchases yet</p>
                <span>Your credit purchases will appear here.</span>
              </div>
            ) : (
              <>
                <div className="ix-table-wrap">
                  <table className="ix-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Tokens</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map(p => (
                        <tr key={p.id}>
                          <td>{formatDate(p.purchased_at)}</td>
                          <td>{formatTokens(p.token_amount)}</td>
                          <td>{formatINR(p.price_paid)}</td>
                          <td>{p.payment_method || 'Test'}</td>
                          <td>
                            <span className={`ix-badge ix-badge--${p.payment_status === 'completed' ? 'paid' : p.payment_status === 'pending' ? 'pending' : 'failed'}`}>
                              {p.payment_status === 'completed' && <Check size={12} />}
                              {p.payment_status === 'pending' && <Loader2 size={12} />}
                              {p.payment_status === 'failed' && <X size={12} />}
                              {p.payment_status === 'completed' ? 'Completed' : p.payment_status === 'pending' ? 'Pending' : 'Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {purMaxPages > 1 && (
                  <div className="bl-pagination">
                    <button className="md-btn" disabled={purPage <= 1} onClick={() => setPurPage(purPage - 1)}><ChevronLeft size={14} /></button>
                    <span className="bl-pagination__info">Page {purPage} of {purMaxPages}</span>
                    <button className="md-btn" disabled={purPage >= purMaxPages} onClick={() => setPurPage(purPage + 1)}><ChevronRight size={14} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Billing
