import { ArrowUpRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const UpgradeCTA = ({ variant = 'default', context = 'quota' }) => {
  const navigate = useNavigate()

  if (variant === 'pro') {
    return (
      <div style={{
        padding: '16px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--warning) 10%, transparent), color-mix(in srgb, var(--warning) 10%, transparent))',
        border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--warning)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Upgrade to Pro</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          Get unlimited tokens, premium models (GPT-class), and dedicated GPU inference.
        </p>
        <button
          onClick={() => navigate('/buy-credits')}
          className="btn-primary"
          style={{ background: 'linear-gradient(135deg, var(--warning), var(--error))' }}
        >
          <Sparkles size={12} />
          View Plans
          <ArrowUpRight size={12} />
        </button>
      </div>
    )
  }

  // Default: show pro upgrade
  return <UpgradeCTA variant="pro" context={context} />
}

export default UpgradeCTA
