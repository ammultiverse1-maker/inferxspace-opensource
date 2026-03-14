import { Zap, ArrowRight } from 'lucide-react'

const FreeModelBadge = ({ model, isFree }) => {
  // Accept explicit isFree prop or default to false
  if (!model || !isFree) return null

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, black))',
      color: 'white',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    }}>
      <Zap size={10} />
      FREE
    </span>
  )
}

export default FreeModelBadge
