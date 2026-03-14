import './BuyCredits.css'
import { useState, useEffect } from 'react'
import { Check, Loader2, AlertCircle, Sparkles, Zap, CreditCard, ArrowRight } from 'lucide-react'
import { creditsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BuyCredits = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [selectedPackage, setSelectedPackage] = useState('custom')
  const [customAmount, setCustomAmount] = useState(500)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasCredits, setHasCredits] = useState(false)

  useEffect(() => {
    const checkCredits = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500))
        const response = await creditsApi.getBalance()
        if (response.data.total_purchased > 0) setHasCredits(true)
      } catch (error) {
        console.warn('Could not check credits balance:', error)
      }
    }
    checkCredits()
  }, [navigate])

  const packages = [
    { id: 'starter', amount: 100, tokens: '100K', tag: 'Starter' },
    { id: 'basic', amount: 499, tokens: '600K', tag: 'Popular' },
    { id: 'growth', amount: 1499, tokens: '1.8M', tag: null },
    { id: 'pro', amount: 4999, tokens: '10M', tag: 'Best Value' },
    { id: 'enterprise', amount: 19999, tokens: '50M', tag: 'Enterprise' },
  ]

  const tokensForAmount = (amount) => {
    if (amount < 500) return `${amount}K`
    if (amount < 1000) return `${Math.round(amount * 1.2)}K`
    return `${Math.round(amount / 100) / 10}M`
  }

  const handlePackageSelect = (id) => {
    setSelectedPackage(id)
    if (id !== 'custom') setCustomAmount(parseInt(id))
  }

  const handlePayment = async () => {
    if (customAmount < 100) { setError('Minimum recharge amount is ₹100'); return }
    try {
      setLoading(true); setError('')
      const { data: result } = await creditsApi.testPurchase({ package: selectedPackage === 'custom' ? 'starter' : selectedPackage })
      if (result.success) navigate('/')
      else setError('Purchase failed. Please try again.')
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Purchase Tokens</h1>
            <p className="ov-header__sub">Choose a package or enter a custom amount to get started.</p>
          </div>
        </div>

        {hasCredits && (
          <div className="ix-info-banner">
            <Sparkles size={16} />
            <span>You already have tokens. Purchase more to top up your balance.</span>
          </div>
        )}

        {/* Quick Packages */}
        <div className="bc-packages">
          {packages.map(pkg => (
            <button key={pkg.id}
              className={`bc-pkg ${selectedPackage === pkg.id ? 'bc-pkg--active' : ''}`}
              onClick={() => handlePackageSelect(pkg.id)}>
              {pkg.tag && <span className="bc-pkg__tag">{pkg.tag}</span>}
              <span className="bc-pkg__amount">₹{pkg.amount.toLocaleString()}</span>
              <span className="bc-pkg__tokens">{pkg.tokens} tokens</span>
              {selectedPackage === pkg.id && <Check size={16} className="bc-pkg__check" />}
            </button>
          ))}
          <button className={`bc-pkg ${selectedPackage === 'custom' ? 'bc-pkg--active' : ''}`}
            onClick={() => handlePackageSelect('custom')}>
            <span className="bc-pkg__amount">Custom</span>
            <span className="bc-pkg__tokens">Enter amount</span>
            {selectedPackage === 'custom' && <Check size={16} className="bc-pkg__check" />}
          </button>
        </div>

        {/* Purchase Card */}
        <div className="bc-purchase-card">
          <div className="bc-purchase-card__form">
            <label className="pg-field__label">Amount (INR)</label>
            <div className="bc-amount-input">
              <span className="bc-amount-input__prefix">₹</span>
              <input type="number" value={customAmount} onChange={(e) => { setCustomAmount(parseInt(e.target.value) || 0); setSelectedPackage('custom') }}
                min="50" className="pg-input" style={{ paddingLeft: 32 }} />
            </div>
            <div className="bc-token-preview">
              <Zap size={16} />
              You'll get approximately <strong>{tokensForAmount(customAmount)} tokens</strong>
            </div>
          </div>

          {error && (
            <div className="bc-error"><AlertCircle size={14} /> {error}</div>
          )}

          <button className="ov-action-btn ov-action-btn--primary bc-buy-btn" onClick={handlePayment} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><CreditCard size={15} /> Purchase Credits (Test Mode)</>}
          </button>

          <p className="bc-disclaimer">Test mode — credits are added instantly without payment.</p>
        </div>
      </div>
    </div>
  )
}

export default BuyCredits
