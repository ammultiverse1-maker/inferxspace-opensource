import './Models.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Info, Zap, DollarSign, Server, CheckCircle, XCircle, Cpu, Globe, PlayCircle, BookOpen, ChevronRight, Clock } from 'lucide-react'
import { modelsApi } from '../api/endpoints'
import Modal from '../components/Modal'

const Models = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const categories = [
    { id: 'all', label: 'All Models', icon: Cpu },
    { id: 'free', label: 'Free Tier', icon: Zap },
    { id: 'paid', label: 'Paid Models', icon: DollarSign },
    { id: 'text', label: 'Text Generation', icon: Server },
  ]

  useEffect(() => { fetchModels() }, [])

  const fetchModels = async () => {
    try {
      setLoading(true)
      const res = await modelsApi.list()
      const apiModels = res.data.models || []
      const transformedModels = apiModels.map(model => ({
        id: model.id,
        name: model.name,
        category: model.is_free ? 'free' : 'paid',
        provider: model.provider || 'Unknown',
        context: model.context_window ? `${model.context_window.toLocaleString()}` : 'N/A',
        features: getModelFeatures(model),
        pricing: { input: model.pricing?.input_per_1k || 0, output: model.pricing?.output_per_1k || 0 },
        status: model.is_active ? 'online' : 'offline',
        is_free: model.is_free || false,
        is_paid_available: model.is_paid_available || false,
        free_delay_ms: model.free_delay_ms || 0,
      }))
      setModels(transformedModels)
    } catch (err) {
      console.error('Failed to fetch models:', err)
      setError('Failed to load models')
    } finally { setLoading(false) }
  }

  const getModelFeatures = (model) => {
    const features = []
    if (model.supports_streaming) features.push('Streaming')
    if (model.supports_function_calling) features.push('Function calling')
    if (model.is_free) features.push('Free')
    if (model.max_output_tokens) features.push(`${model.max_output_tokens} max tokens`)
    return features.join(', ') || 'Standard features'
  }

  const filteredModels = models.filter(model => {
    let matchesCategory = selectedCategory === 'all'
    if (selectedCategory === 'free') matchesCategory = model.is_free
    if (selectedCategory === 'paid') matchesCategory = !model.is_free
    if (selectedCategory === 'text') matchesCategory = true  // All are text generation models
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          model.provider.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  if (loading) {
    return (
      <div className="content-area">
        <div className="ov-loading"><Loader2 className="animate-spin" size={36} color="var(--primary)" /><span>Loading models...</span></div>
      </div>
    )
  }

  return (
    <div className="content-area">
      <div className="ov-page">
        {/* Header */}
        <div className="ov-header">
          <div>
            <h1 className="ov-header__title">Model Catalog</h1>
            <p className="ov-header__sub">{models.length} models available — all hosted in India for low-latency access.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="md-filters">
          <div className="md-categories">
            {categories.map(cat => (
              <button key={cat.id} className={`md-cat-btn ${selectedCategory === cat.id ? 'md-cat-btn--active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}>
                <cat.icon size={14} />
                {cat.label}
                <span className="md-cat-btn__count">
                  {cat.id === 'all' ? models.length :
                   cat.id === 'free' ? models.filter(m => m.is_free).length :
                   cat.id === 'paid' ? models.filter(m => !m.is_free).length :
                   models.length}
                </span>
              </button>
            ))}
          </div>
          <div className="md-search">
            <Search size={16} />
            <input type="text" placeholder="Search models..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Models Grid */}
        <div className="md-grid">
          {filteredModels.map(model => (
            <div key={model.id} className={`md-card ${model.is_free ? 'md-card--free' : ''}`}>
              <div className="md-card__top">
                <div className="md-card__status">
                  <span className={`md-status-dot md-status-dot--${model.status}`} />
                  {model.status === 'online' ? 'Online' : 'Offline'}
                </div>
                {model.is_free && <span className="md-card__free-badge">Free</span>}
                {model.is_free && model.is_paid_available && (
                  <span className="md-card__free-badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', marginLeft: 4 }}>+ Pro</span>
                )}
              </div>

              <h3 className="md-card__name">{model.name}</h3>
              <p className="md-card__meta">
                {model.provider} · {model.context} ctx · {model.features}
              </p>

              <div className="md-card__pricing">
                {model.is_free ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={11} style={{ color: '#f59e0b' }} />
                      <span className="md-price md-price--free">FREE (delayed)</span>
                    </div>
                    {model.is_paid_available && model.pricing.input > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={11} style={{ color: '#10b981' }} />
                        <span className="md-price" style={{ fontSize: '11px', opacity: 0.8 }}>
                          Pro: ₹{model.pricing.input}/1K in · ₹{model.pricing.output}/1K out
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="md-price">₹{model.pricing.input}/1K in</span>
                    <span className="md-price-sep">·</span>
                    <span className="md-price">₹{model.pricing.output}/1K out</span>
                  </>
                )}
              </div>

              <div className="md-card__actions">
                <button className="md-btn md-btn--primary" onClick={() => navigate(`/playground?model=${model.id}`)}>
                  <PlayCircle size={14} /> Try it
                </button>
                <button className="md-btn" onClick={() => { setSelectedModel(model); setIsModalOpen(true) }}>
                  <BookOpen size={14} /> Docs
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredModels.length === 0 && (
          <div className="ov-empty-state" style={{ marginTop: 40 }}>
            <Search size={24} />
            <span>No models match your search</span>
          </div>
        )}
      </div>

      {/* Model Docs Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedModel(null) }}
        title={selectedModel?.name || 'Model Documentation'} subtitle="Model specifications" size="lg">
        {selectedModel && (
          <div className="md-docs">
            <div className="md-docs__grid">
              <div className="md-docs__item"><span>Status</span><span className={selectedModel.status}>{selectedModel.status === 'online' ? '● Online' : '○ Offline'}</span></div>
              <div className="md-docs__item"><span>Provider</span><span>{selectedModel.provider}</span></div>
              <div className="md-docs__item"><span>Context Window</span><span>{selectedModel.context}</span></div>
              <div className="md-docs__item"><span>Category</span><span style={{ textTransform: 'capitalize' }}>{selectedModel.category}</span></div>
              <div className="md-docs__item"><span>Input Price</span><span>{selectedModel.is_free ? 'FREE (delayed)' : `₹${selectedModel.pricing.input}/1K`}</span></div>
              <div className="md-docs__item"><span>Output Price</span><span>{selectedModel.is_free ? 'FREE (delayed)' : `₹${selectedModel.pricing.output}/1K`}</span></div>
              {selectedModel.is_free && selectedModel.is_paid_available && (
                <>
                  <div className="md-docs__item"><span>Pro Input</span><span>₹{selectedModel.pricing.input}/1K</span></div>
                  <div className="md-docs__item"><span>Pro Output</span><span>₹{selectedModel.pricing.output}/1K</span></div>
                </>
              )}
              {selectedModel.free_delay_ms > 0 && (
                <div className="md-docs__item"><span>Free Delay</span><span>{(selectedModel.free_delay_ms / 1000).toFixed(1)}s</span></div>
              )}
              <div className="md-docs__item"><span>Hosted</span><span>India</span></div>
            </div>
            <div className="md-docs__features">
              <h4>Features</h4>
              <div className="md-docs__tags">
                {selectedModel.features.split(', ').map((f, i) => (
                  <span key={i} className="md-docs__tag"><CheckCircle size={12} />{f}</span>
                ))}
                <span className="md-docs__tag"><CheckCircle size={12} />Streaming</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Models
