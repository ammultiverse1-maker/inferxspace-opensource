import './Overview.css'
import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { usageApi, modelsApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import { Loader2, TrendingUp, Wallet, Zap, Activity, ArrowRight, Key, BookOpen, CreditCard, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { freeTierApi } from '../api/freeTier'

const Overview = () => {
  const { user } = useAuth()
  const { dashboardData, chartData, recentActivity, loading, refreshDashboard } = useDashboard()
  const [freeQuota, setFreeQuota] = useState(null)

  useEffect(() => {
    const fetchFreeQuota = async () => {
      try {
        const res = await freeTierApi.getQuota()
        setFreeQuota(res.data)
      } catch (err) {
        console.error('Failed to fetch free tier quota:', err)
      }
    }
    fetchFreeQuota()
  }, [])

  const userBalance = dashboardData?.balance_inr || dashboardData?.balance_rupees || dashboardData?.balance || 0
  const monthUsage = dashboardData?.this_month_usage || 0
  const totalSpend = dashboardData?.total_spend || 0

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading">
          <Loader2 className="animate-spin" size={36} color="var(--primary)" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const freeUsagePercent = freeQuota && freeQuota.tokens_limit > 0
    ? Math.min(100, (freeQuota.tokens_used / freeQuota.tokens_limit) * 100)
    : 0

  const freeBarColor = freeUsagePercent >= 90 ? 'var(--error)' : freeUsagePercent >= 70 ? 'var(--warning)' : 'var(--success)'

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* ── Header ── */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
            <p className="ov-header__sub">Here's your usage snapshot and recent activity.</p>
          </div>
          <div className="ov-header__actions">
            <Link to="/buy-credits" className="ov-action-btn ov-action-btn--primary">
              <CreditCard size={15} />
              Buy Credits
            </Link>
            <Link to="/playground" className="ov-action-btn">
              <Zap size={15} />
              Playground
            </Link>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="ov-stats">
          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--purple">
              <Wallet size={20} />
            </div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Credit Balance</span>
              <span className="ov-stat-card__value">₹{userBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--green">
              <Zap size={20} />
            </div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">
                Free Tier
                <span className="ov-stat-card__badge" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                  Shared
                </span>
              </span>
              <span className="ov-stat-card__value">{freeQuota ? freeQuota.tokens_used.toLocaleString() : '0'}<small>tokens</small></span>
              <div className="ov-stat-card__bar">
                <div className="ov-stat-card__bar-fill" style={{ width: `${freeUsagePercent}%`, background: freeBarColor }} />
              </div>
              <span className="ov-stat-card__hint">
                {freeQuota ? `${freeQuota.tokens_used.toLocaleString()} / ${freeQuota.tokens_limit.toLocaleString()} daily` : 'Loading...'}
              </span>
            </div>
          </div>

          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--blue">
              <Activity size={20} />
            </div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Premium Usage</span>
              <span className="ov-stat-card__value">{monthUsage.toLocaleString()}<small>tokens/mo</small></span>
            </div>
          </div>

          <div className="ov-stat-card">
            <div className="ov-stat-card__icon ov-stat-card__icon--pink">
              <TrendingUp size={20} />
            </div>
            <div className="ov-stat-card__body">
              <span className="ov-stat-card__label">Total Spend</span>
              <span className="ov-stat-card__value">₹{totalSpend.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="ov-quick-links">
          <Link to="/api-keys" className="ov-quick-link">
            <Key size={18} />
            <div>
              <span className="ov-quick-link__title">API Keys</span>
              <span className="ov-quick-link__desc">Manage your keys</span>
            </div>
            <ArrowRight size={16} className="ov-quick-link__arrow" />
          </Link>
          <Link to="/buy-credits" className="ov-quick-link">
            <CreditCard size={18} />
            <div>
              <span className="ov-quick-link__title">Buy Credits</span>
              <span className="ov-quick-link__desc">Top up for premium models</span>
            </div>
            <ArrowRight size={16} className="ov-quick-link__arrow" />
          </Link>
          <Link to="/documentation" className="ov-quick-link">
            <BookOpen size={18} />
            <div>
              <span className="ov-quick-link__title">Documentation</span>
              <span className="ov-quick-link__desc">API reference & guides</span>
            </div>
            <ArrowRight size={16} className="ov-quick-link__arrow" />
          </Link>
        </div>

        {/* ── Bottom Row: Chart + Activity ── */}
        <div className="ov-bottom-grid">
          {/* Usage Chart */}
          <div className="ov-card ov-card--chart">
            <div className="ov-card__header">
              <h3>Usage (30 days)</h3>
            </div>
            <div className="ov-card__body" style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="fullDate"
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)' }}
                    formatter={(value) => [`${(value / 1000).toFixed(1)}K`, 'Tokens']}
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="tokens" stroke="var(--primary)" strokeWidth={2.5} fill="url(#ovGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="ov-card">
            <div className="ov-card__header">
              <h3>Recent Activity</h3>
              <Link to="/request-logs" className="ov-card__link">View all <ExternalLink size={12} /></Link>
            </div>
            <div className="ov-card__body">
              {recentActivity.length > 0 ? (
                <div className="ov-activity-list">
                  {recentActivity.slice(0, 8).map((a, i) => (
                    <div key={i} className="ov-activity-item">
                      <div className="ov-activity-item__dot" />
                      <div className="ov-activity-item__info">
                        <span className="ov-activity-item__model">{a.model}</span>
                        <span className="ov-activity-item__date">{a.date}</span>
                      </div>
                      <span className="ov-activity-item__tokens">{a.tokens} tok</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ov-empty-state">
                  <Activity size={24} />
                  <span>No recent activity</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Overview
