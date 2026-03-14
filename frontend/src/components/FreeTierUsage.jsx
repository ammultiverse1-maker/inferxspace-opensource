import { useState, useEffect } from 'react'
import { Zap, TrendingUp, Clock } from 'lucide-react'
import { freeTierApi } from '../api/freeTier'

const FreeTierUsage = ({ compact = false }) => {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuota()
  }, [])

  const fetchQuota = async () => {
    try {
      setLoading(true)
      const res = await freeTierApi.getQuota()
      setQuota(res.data)
    } catch (err) {
      console.error('Failed to fetch free tier quota:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !quota) {
    return (
      <div className="free-tier-usage-card" style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Zap size={18} style={{ color: 'var(--success)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Free Tier Usage</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</div>
      </div>
    )
  }

  const tokenPercent = quota.tokens_limit > 0 
    ? Math.min(100, (quota.tokens_used / quota.tokens_limit) * 100) 
    : 0
  const reqPercent = quota.requests_limit > 0
    ? Math.min(100, (quota.requests_used / quota.requests_limit) * 100)
    : 0

  const getBarColor = (pct) => {
    if (pct >= 90) return 'var(--error)'
    if (pct >= 70) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} style={{ color: 'var(--success)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Free Tier Usage</span>
        </div>
        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '10px',
          background: 'var(--success)',
          color: 'white',
          fontWeight: 500,
        }}>
          Shared
        </span>
      </div>

      {/* Token Usage */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tokens</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {quota.tokens_used.toLocaleString()} / {quota.tokens_limit.toLocaleString()}
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'var(--bg-tertiary, var(--border))',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${tokenPercent}%`,
            background: getBarColor(tokenPercent),
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Request Usage */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Requests</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {quota.requests_used} / {quota.requests_limit}
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'var(--bg-tertiary, var(--border))',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${reqPercent}%`,
            background: getBarColor(reqPercent),
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Reset info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
        <Clock size={12} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Resets daily at midnight UTC
        </span>
      </div>

      {(quota.tokens_used >= quota.tokens_limit || quota.requests_used >= quota.requests_limit) ? (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          borderRadius: '8px',
          background: 'color-mix(in srgb, var(--error) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
          fontSize: '12px',
          color: 'var(--error)',
          fontWeight: 600,
        }}>
          Daily limit reached — free tier is closed for today. Please deposit money to use the Pro plan.
        </div>
      ) : tokenPercent >= 80 ? (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          borderRadius: '8px',
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
          fontSize: '12px',
          color: 'var(--warning)',
        }}>
          You're nearing your daily limit. Deposit money to upgrade to Pro for unlimited tokens.
        </div>
      ) : null}
    </div>
  )
}

export default FreeTierUsage
