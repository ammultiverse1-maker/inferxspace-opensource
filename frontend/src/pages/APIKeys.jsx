import './APIKeys.css'
import { useState, useEffect } from 'react'
import { Key, Copy, Check, RefreshCw, Trash2, X, AlertCircle, RotateCw, Loader2, Plus, Shield, Clock } from 'lucide-react'
import { apiKeyApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { notify } from '../utils/notify'

const APIKeys = () => {
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchKeys() }, [])

  const fetchKeys = async () => {
    try {
      setLoading(true)
      const response = await apiKeyApi.list()
      const payload = response.data
      if (Array.isArray(payload)) setApiKeys(payload)
      else if (payload?.keys) setApiKeys(payload.keys)
      else setApiKeys([])
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally { setLoading(false) }
  }

  const handleCreateKey = async () => {
    try {
      setActionLoading(true)
      const response = await apiKeyApi.create({ name: newKeyName, scopes: ["inference:read", "inference:write"] })
      setGeneratedKey(response.data.key)
      setShowCreateModal(false)
      setShowResultModal(true)
      setNewKeyName('')
      fetchKeys()
    } catch (error) { console.error('Failed to create key:', error) }
    finally { setActionLoading(false) }
  }

  const handleRegenerateKey = async () => {
    try {
      setActionLoading(true)
      const response = await apiKeyApi.regenerate(selectedKey.id)
      setGeneratedKey(response.data.key)
      setShowRegenerateModal(false)
      setShowResultModal(true)
      fetchKeys()
    } catch (error) { console.error('Failed to regenerate key:', error) }
    finally { setActionLoading(false) }
  }

  const handleDeleteKey = async () => {
    try {
      setActionLoading(true)
      await apiKeyApi.delete(selectedKey.id)
      setShowDeleteModal(false)
      setSelectedKey(null)
      fetchKeys()
    } catch (error) {
      console.error('Failed to delete key:', error)
      notify('error', `Failed to delete: ${error.response?.data?.detail || error.message}`)
    } finally { setActionLoading(false) }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  if (loading && apiKeys.length === 0) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading keys...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">API Keys</h1>
            <p className="ov-header__sub">Manage your API keys for production and testing.</p>
          </div>
          <div className="ov-header__actions">
            <button className="ov-action-btn ov-action-btn--primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={15} /> Create New Key
            </button>
          </div>
        </div>

        {apiKeys.length === 0 ? (
          /* Empty State */
          <div className="ak-empty">
            <div className="ak-empty__icon"><Key size={36} /></div>
            <h2>No API Keys Yet</h2>
            <p>Create your first API key to start making requests.</p>
            <button className="ov-action-btn ov-action-btn--primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={15} /> Create API Key
            </button>
          </div>
        ) : (
          <>
            {/* Keys List */}
            <div className="ak-list">
              {apiKeys.map(key => (
                <div key={key.id} className="ak-card">
                  <div className="ak-card__header">
                    <div className="ak-card__info">
                      <Key size={16} className="ak-card__key-icon" />
                      <h3>{key.name}</h3>
                      <span className="ak-card__badge">Active</span>
                    </div>
                  </div>
                  <div className="ak-card__key-row">
                    <code>{key.key || key.key_prefix || ''}</code>
                    <button className="pg-msg__action" onClick={() => copyToClipboard(key.key || key.key_prefix)}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="ak-card__meta">
                    <span><Clock size={12} /> Created: {formatDate(key.created_at)}</span>
                    <span><Clock size={12} /> Last used: {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}</span>
                  </div>
                  <div className="ak-card__actions">
                    <button className="md-btn" onClick={() => { setSelectedKey(key); setShowRegenerateModal(true) }}>
                      <RotateCw size={13} /> Regenerate
                    </button>
                    <button className="md-btn md-btn--danger" onClick={() => { setSelectedKey(key); setShowDeleteModal(true) }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Security Tips */}
            <div className="ak-security">
              <Shield size={16} />
              <div>
                <strong>Security Best Practices</strong>
                <p>Never share keys in public repos or client-side code. Regenerate immediately if compromised.</p>
              </div>
            </div>
          </>
        )}

        {/* Modals */}
        {showCreateModal && (
          <div className="pg-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Create New API Key</h3><button onClick={() => setShowCreateModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                <label className="pg-field__label">Key Name</label>
                <input type="text" className="pg-input" placeholder='e.g., "Production API"' value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="md-btn md-btn--primary" onClick={handleCreateKey} disabled={actionLoading || !newKeyName}>
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Create Key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showResultModal && (
          <div className="pg-modal-overlay" onClick={() => setShowResultModal(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>API Key Generated</h3><button onClick={() => setShowResultModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Copy your key now — you won't see it again!</p>
                <div className="ak-card__key-row" style={{ background: 'var(--background)' }}>
                  <code style={{ wordBreak: 'break-all' }}>{generatedKey}</code>
                  <button className="pg-msg__action" onClick={() => copyToClipboard(generatedKey)}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn md-btn--primary" onClick={() => setShowResultModal(false)}>I've copied it</button>
              </div>
            </div>
          </div>
        )}

        {showRegenerateModal && selectedKey && (
          <div className="pg-modal-overlay" onClick={() => setShowRegenerateModal(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Regenerate Key?</h3><button onClick={() => setShowRegenerateModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>The old key will be invalidated immediately. Update your applications.</p>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn" onClick={() => setShowRegenerateModal(false)}>Cancel</button>
                <button className="md-btn md-btn--warning" onClick={handleRegenerateKey} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && selectedKey && (
          <div className="pg-modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Delete API Key?</h3><button onClick={() => setShowDeleteModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                <p style={{ color: 'var(--error)', fontSize: 13 }}>This cannot be undone. Applications using this key will stop working.</p>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="md-btn md-btn--danger" onClick={handleDeleteKey} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default APIKeys
