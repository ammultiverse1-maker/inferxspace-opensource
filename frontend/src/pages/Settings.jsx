import './Settings.css'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { userApi, authApi } from '../api/endpoints'
import { notify } from '../utils/notify'

import FreeTierUsage from '../components/FreeTierUsage'
import { User, Bell, Shield, Key, AlertTriangle, Loader2, X, Save, Lock, FileText, Trash2 } from 'lucide-react'

const Settings = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ fullName: '', email: '', company: '' })
  const [notifications, setNotifications] = useState({ email_notifications: true, usage_alerts: true })
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(100000)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        if (user) setFormData({ fullName: user.name || '', email: user.email || '', company: user.company || '' })
        try {
          const res = await userApi.getSettings()
          const s = res.data
          setNotifications({ email_notifications: s.email_notifications ?? true, usage_alerts: s.usage_alerts ?? true })
          setLowBalanceThreshold(s.low_balance_threshold ?? 100000)
        } catch (e) { console.warn('Could not load settings:', e) }
      } catch (e) { console.error('Failed:', e) }
      finally { setLoading(false) }
    }
    loadData()
  }, [user])

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSaveProfile = async () => {
    try { setSaving(true); await userApi.updateProfile({ name: formData.fullName, company: formData.company }); notify('success', 'Profile updated!') }
    catch (e) { notify('error', 'Failed to update profile.') }
    finally { setSaving(false) }
  }

  const handleSaveSettings = async () => {
    try { setSaving(true); await userApi.updateSettings({ email_notifications: notifications.email_notifications, usage_alerts: notifications.usage_alerts, low_balance_threshold: lowBalanceThreshold }); notify('success', 'Settings saved!') }
    catch (e) { notify('error', 'Failed to save settings.') }
    finally { setSaving(false) }
  }

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true)
      await userApi.deleteAccount()
      notify('success', 'Account deleted.')
      window.location.href = '/login'
    } catch (e) { notify('error', e.response?.data?.detail || 'Failed to delete account.') }
    finally { setDeleting(false); setShowDeleteConfirm(false) }
  }

  const handleToggle = (key) => setNotifications(prev => ({ ...prev, [key]: !prev[key] }))

  const handlePasswordInputChange = (e) => { setPasswordData({ ...passwordData, [e.target.name]: e.target.value }); setPasswordError('') }

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) { setPasswordError('All fields are required'); return }
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPasswordError('New passwords do not match'); return }
    if (passwordData.newPassword.length < 8) { setPasswordError('Min 8 characters with uppercase, lowercase, and number'); return }
    if (!/[A-Z]/.test(passwordData.newPassword)) { setPasswordError('Must contain uppercase letter'); return }
    if (!/[a-z]/.test(passwordData.newPassword)) { setPasswordError('Must contain lowercase letter'); return }
    if (!/\d/.test(passwordData.newPassword)) { setPasswordError('Must contain a number'); return }
    try {
      setChangingPassword(true); setPasswordError('')
      await authApi.changePassword({ current_password: passwordData.currentPassword, new_password: passwordData.newPassword })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPasswordModal(false)
      notify('success', 'Password changed!')
    } catch (e) { setPasswordError(e.response?.data?.detail || 'Failed to change password.') }
    finally { setChangingPassword(false) }
  }

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading settings...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Settings</h1>
            <p className="ov-header__sub">Manage your profile, notifications, and account preferences.</p>
          </div>
        </div>

        <div className="st-grid">
          {/* Profile Card */}
          <div className="st-card">
            <div className="st-card__header"><User size={18} /> Profile Settings</div>
            <div className="st-card__body">
              <div className="st-field">
                <label className="pg-field__label">Full Name</label>
                <input type="text" className="pg-input" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Enter your full name" />
              </div>
              <div className="st-field">
                <label className="pg-field__label">Email Address</label>
                <input type="email" className="pg-input" name="email" value={formData.email} onChange={handleInputChange} placeholder="Enter your email" disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="st-field">
                <label className="pg-field__label">Company Name</label>
                <input type="text" className="pg-input" name="company" value={formData.company} onChange={handleInputChange} placeholder="Enter company name" />
              </div>
              <div className="st-card__actions">
                <button className="md-btn md-btn--primary" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="md-btn" onClick={() => setShowPasswordModal(true)}>
                  <Lock size={14} /> Change Password
                </button>
              </div>
            </div>
          </div>

          {/* Notifications Card */}
          <div className="st-card">
            <div className="st-card__header"><Bell size={18} /> Notifications</div>
            <div className="st-card__body">
              {[
                { key: 'email_notifications', title: 'Email Notifications', desc: 'Receive email alerts for low balance and important updates' },
                { key: 'usage_alerts', title: 'Usage Alerts', desc: 'Get notified when reaching token usage thresholds' },
              ].map(item => (
                <div key={item.key} className="st-toggle-row">
                  <div className="st-toggle-row__info">
                    <span className="st-toggle-row__title">{item.title}</span>
                    <span className="st-toggle-row__desc">{item.desc}</span>
                  </div>
                  <button className={`pg-switch ${notifications[item.key] ? 'pg-switch--on' : ''}`} onClick={() => handleToggle(item.key)}>
                    <span className="pg-slider" />
                  </button>
                </div>
              ))}
              <div className="st-field" style={{ marginTop: 12 }}>
                <label className="pg-field__label">Low Balance Threshold (tokens)</label>
                <input type="number" className="pg-input" value={lowBalanceThreshold} onChange={(e) => setLowBalanceThreshold(parseInt(e.target.value) || 0)} placeholder="100000" min="0" step="10000" />
              </div>
              <div className="st-card__actions">
                <button className="md-btn md-btn--primary" onClick={handleSaveSettings} disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>

          {/* Free Tier Usage */}
          <div className="st-card">
            <div className="st-card__header"><Key size={18} /> Free Tier Usage</div>
            <div className="st-card__body">
              <FreeTierUsage />
            </div>
          </div>

          {/* Terms */}
          <div className="st-card">
            <div className="st-card__header"><FileText size={18} /> Terms and Conditions</div>
            <div className="st-card__body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                Review the terms that govern your use of InferXspace, including usage policies, data handling, and privacy practices.
              </p>
              <button className="md-btn" onClick={() => setShowTermsModal(true)}>
                <FileText size={14} /> View Full Terms
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="st-card st-card--danger">
            <div className="st-card__header"><AlertTriangle size={18} /> Danger Zone</div>
            <div className="st-card__body">
              <div className="st-danger-row">
                <div>
                  <strong>Delete Account</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Permanently delete your account, API keys, and all data.</p>
                </div>
                <button className="md-btn md-btn--danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /> Delete Account</button>
              </div>
            </div>
          </div>
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="pg-modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Change Password</h3><button onClick={() => setShowPasswordModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                {passwordError && <div className="bc-error" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> {passwordError}</div>}
                <div className="st-field"><label className="pg-field__label">Current Password</label><input type="password" className="pg-input" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordInputChange} placeholder="Enter current password" /></div>
                <div className="st-field"><label className="pg-field__label">New Password</label><input type="password" className="pg-input" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordInputChange} placeholder="Enter new password" /></div>
                <div className="st-field"><label className="pg-field__label">Confirm Password</label><input type="password" className="pg-input" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordInputChange} placeholder="Confirm new password" /></div>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button className="md-btn md-btn--primary" onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? <Loader2 className="animate-spin" size={16} /> : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="pg-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="ix-modal" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Delete Account</h3><button onClick={() => setShowDeleteConfirm(false)}><X size={18} /></button></div>
              <div className="ix-modal__body">
                <div className="bc-error" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> This action is irreversible. All your data, API keys, and credits will be permanently deleted.</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Are you sure you want to delete your account?</p>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="md-btn md-btn--danger" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Terms Modal */}
        {showTermsModal && (
          <div className="pg-modal-overlay" onClick={() => setShowTermsModal(false)}>
            <div className="ix-modal ix-modal--lg" onClick={e => e.stopPropagation()}>
              <div className="ix-modal__header"><h3>Terms and Conditions</h3><button onClick={() => setShowTermsModal(false)}><X size={18} /></button></div>
              <div className="ix-modal__body" style={{ maxHeight: 500, overflow: 'auto' }}>
                <div className="st-terms">
                  <h4>1. Acceptance of Terms</h4>
                  <p>By accessing and using InferXspace, you accept and agree to be bound by the terms and provision of this agreement.</p>
                  <h4>2. Use License</h4>
                  <p>Permission is granted to temporarily use InferXspace for personal, non-commercial transitory viewing only.</p>
                  <h4>3. Disclaimer</h4>
                  <p>The materials on InferXspace are provided on an 'as is' basis. InferXspace makes no warranties, expressed or implied.</p>
                  <h4>4. Limitations</h4>
                  <p>In no event shall InferXspace or its suppliers be liable for any damages arising out of the use or inability to use InferXspace.</p>
                  <h4>5. Accuracy of Materials</h4>
                  <p>The materials appearing on InferXspace could include technical, typographical, or photographic errors.</p>
                  <h4>6. Modifications</h4>
                  <p>InferXspace may revise these terms of service at any time without notice.</p>
                  <h4>7. Governing Law</h4>
                  <p>These terms are governed by the laws of India.</p>
                </div>
              </div>
              <div className="ix-modal__footer">
                <button className="md-btn md-btn--primary" onClick={() => setShowTermsModal(false)}>I Understand</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
