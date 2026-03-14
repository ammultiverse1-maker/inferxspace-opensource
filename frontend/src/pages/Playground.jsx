import './Playground.css'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Sparkles, Copy, Check, Code, ChevronDown, Loader2, 
  Database, Upload, FileText, X, Shield, Send, RotateCcw, 
  Zap, Clock, Coins, Bot, User, Settings2,
  AlertCircle, BookOpen, Cpu, Thermometer, SlidersHorizontal,
  MessageSquare, Hash, Layers, Wrench, DollarSign
} from 'lucide-react'
import { modelsApi, completionsApi, pricingApi } from '../api/endpoints'
import { freeTierApi } from '../api/freeTier'
import { documentsApi, guardrailsApi } from '../api/platformServices'
import { useDashboard } from '../context/DashboardContext'
import { knowledgeBaseAPI } from '../api/knowledgeBase'
import { agentsApi } from '../api/agents'
import MarkdownContent from '../components/MarkdownContent'
import { notify } from '../utils/notify'

const Playground = () => {
  const [searchParams] = useSearchParams()
  const { refreshDashboard } = useDashboard()
  const [model, setModel] = useState('')
  const [modelsList, setModelsList] = useState([])
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.')
  const [userMessage, setUserMessage] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ tokens: 0, latency: 0, cost: 0 })
  const [modelPricing, setModelPricing] = useState({})
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [lastPayload, setLastPayload] = useState(null)
  const [configCollapsed, setConfigCollapsed] = useState(false)

  // Conversation history
  const [messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)

  // RAG state
  const [ragEnabled, setRagEnabled] = useState(false)
  const [ragContext, setRagContext] = useState([])
  const [ragSearching, setRagSearching] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const [selectedKB, setSelectedKB] = useState('')
  const [ragTopK, setRagTopK] = useState(5)
  const [ragMaxChunks, setRagMaxChunks] = useState(3)

  // Document processing state
  const [docFile, setDocFile] = useState(null)
  const [docProcessing, setDocProcessing] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // Guardrails state
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(false)

  // Agent state
  const [agentMode, setAgentMode] = useState(false)
  const [agentsList, setAgentsList] = useState([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [agentSessionId, setAgentSessionId] = useState(null)

  // Agent streaming state
  const [agentStreaming, setAgentStreaming] = useState(false)
  const [streamPhase, setStreamPhase] = useState('')   // 'init' | 'reasoning' | 'answering'
  const [liveSteps, setLiveSteps] = useState([])       // steps received so far
  const [streamingAnswer, setStreamingAnswer] = useState('')  // token-by-token answer
  const [activeToolCall, setActiveToolCall] = useState(null)  // currently executing tool
  const streamAbortRef = useRef(null)

  // Wallet / tier state
  const [walletBalance, setWalletBalance] = useState(0)
  const [currentTier, setCurrentTier] = useState('free')  // 'free' | 'paid'

  useEffect(() => {
    fetchModels()
    fetchKnowledgeBases()
    fetchAgents()
    fetchWallet()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-scroll during agent streaming
  useEffect(() => {
    if (agentStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [liveSteps, streamingAnswer, activeToolCall, agentStreaming])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [userMessage])

  const fetchModels = async () => {
    try {
      const res = await modelsApi.list()
      const premiumModels = res.data.models.map(m => m.id)
      const pricingMap = {}
      res.data.models.forEach(m => {
        pricingMap[m.id] = {
          input_per_1k: m.pricing.input_per_1k || 0,
          output_per_1k: m.pricing.output_per_1k || 0
        }
      })
      let freeModels = []
      try {
        const freeRes = await freeTierApi.getModels()
        freeModels = (freeRes.data.models || []).map(m => m.id)
        freeRes.data.models.forEach(m => {
          pricingMap[m.id] = { input_per_1k: 0, output_per_1k: 0 }
        })
      } catch (e) {
        console.warn('Free tier models unavailable:', e)
      }
      const allModels = [...freeModels, ...premiumModels]
      setModelsList(allModels)
      setModelPricing(pricingMap)
      const modelFromUrl = searchParams.get('model')
      if (modelFromUrl && allModels.includes(modelFromUrl)) {
        setModel(modelFromUrl)
      } else if (allModels.length > 0) {
        setModel(allModels[0])
      }
    } catch (e) {
      console.error("Failed to fetch models", e)
    }
  }

  const fetchKnowledgeBases = async () => {
    try {
      const data = await knowledgeBaseAPI.listKnowledgeBases()
      setKnowledgeBases(data.knowledge_bases || [])
      if (data.knowledge_bases?.length > 0 && !selectedKB) {
        setSelectedKB(data.knowledge_bases[0].id)
      } else if (data.knowledge_bases?.length === 0) {
        setSelectedKB('')
      }
    } catch (error) {
      console.error('Failed to load knowledge bases:', error)
      setSelectedKB('')
    }
  }

  const fetchAgents = async () => {
    try {
      const res = await agentsApi.list()
      const agents = res.data?.agents || []
      setAgentsList(agents)
      // If URL has ?agent=<id>, activate agent mode
      const agentFromUrl = searchParams.get('agent')
      if (agentFromUrl && agents.find(a => a.id === agentFromUrl)) {
        setSelectedAgentId(agentFromUrl)
        setAgentMode(true)
        setRagEnabled(false)
        setDocFile(null)
      }
    } catch (e) {
      console.warn('Failed to load agents:', e)
    }
  }

  const getSelectedAgent = () => agentsList.find(a => a.id === selectedAgentId)

  const fetchWallet = async () => {
    try {
      const res = await pricingApi.getWallet()
      setWalletBalance(res.data.balance || 0)
      setCurrentTier(res.data.tier || 'free')
    } catch (e) {
      console.warn('Wallet fetch failed:', e)
      setWalletBalance(0)
      setCurrentTier('free')
    }
  }

  const calculateCost = (modelId, inputTokens, outputTokens) => {
    const pricing = modelPricing[modelId]
    if (!pricing) return 0
    if (pricing.input_per_1k === 0 && pricing.output_per_1k === 0) return 'FREE'
    const inputCost = (inputTokens / 1_000) * pricing.input_per_1k
    const outputCost = (outputTokens / 1_000) * pricing.output_per_1k
    const totalCost = inputCost + outputCost
    if (totalCost === 0) return '₹0.00'
    if (totalCost < 0.01) return `₹${totalCost.toFixed(4)}`
    return `₹${totalCost.toFixed(2)}`
  }

  const getModelLabel = (modelId) => {
    if (!modelId) return ''
    const parts = modelId.split('/')
    return parts[parts.length - 1]
  }

  const isFreeTier = (modelId) => {
    const pricing = modelPricing[modelId]
    return pricing && pricing.input_per_1k === 0 && pricing.output_per_1k === 0
  }

  const handleGenerate = async () => {
    if (!userMessage.trim() && !docFile) return

    // Pre-check free tier quota before sending
    if (isFreeTier(model)) {
      try {
        const quotaRes = await freeTierApi.getQuota()
        const q = quotaRes.data
        if (q.tokens_used >= q.tokens_limit || q.requests_used >= q.requests_limit) {
          const reason = q.tokens_used >= q.tokens_limit ? 'Daily token limit reached' : 'Daily request limit reached'
          notify('error', `${reason}. Please deposit money to upgrade to Pro plan.`)
          setError(`${reason} (${q.tokens_used.toLocaleString()} / ${q.tokens_limit.toLocaleString()} tokens). Free tier is closed for today. Please deposit money to use the Pro plan.`)
          setMessages(prev => [...prev, { role: 'error', content: `${reason}. Free tier is closed for today — please deposit money to use the Pro plan.`, timestamp: new Date() }])
          return
        }
      } catch (e) {
        // If quota check fails, let the backend enforce it
        console.warn('Quota pre-check failed:', e)
      }
    }

    const userMsg = userMessage.trim()
    setLoading(true)
    setError('')
    setRagContext([])

    const newUserMessage = {
      role: 'user',
      content: userMsg,
      timestamp: new Date(),
      ...(docFile ? { docName: docFile.name, docSize: docFile.size } : {})
    }
    setMessages(prev => [...prev, newUserMessage])
    setUserMessage('')

    try {
      const startTime = Date.now()

      // Document processing mode
      if (docFile) {
        setDocProcessing(true)
        try {
          const res = await documentsApi.process(docFile, {
            prompt: userMsg,
            model: model,
            systemPrompt: systemPrompt,
            temperature,
            maxTokens: parseInt(maxTokens),
          })
          const endTime = Date.now()
          const latency = ((endTime - startTime) / 1000).toFixed(2)
          let answer = res.data.answer
          if (guardrailsEnabled) {
            try {
              const guardRes = await guardrailsApi.applyOutput(answer)
              answer = guardRes.data.processed_text
            } catch (e) { console.warn('Guardrails output check failed:', e) }
          }
          const newStats = {
            tokens: res.data.usage?.total_tokens || 0,
            latency,
            cost: calculateCost(model, res.data.usage?.prompt_tokens || 0, res.data.usage?.completion_tokens || 0),
          }
          setStats(newStats)
          setResponse(answer)
          setMessages(prev => [...prev, {
            role: 'assistant', content: answer, timestamp: new Date(),
            model, stats: newStats, mode: 'document'
          }])
          refreshDashboard()
          return
        } finally { setDocProcessing(false) }
      }

      // RAG mode
      if (ragEnabled && selectedKB) {
        setRagSearching(true)
        const kbResponse = await knowledgeBaseAPI.queryKnowledgeBase(selectedKB, {
          query: userMsg, model, top_k: ragTopK, max_context_chunks: ragMaxChunks,
          system_prompt: systemPrompt, temperature, top_p: topP, max_tokens: parseInt(maxTokens)
        })
        setRagSearching(false)
        const endTime = Date.now()
        const latency = ((endTime - startTime) / 1000).toFixed(2)
        const newStats = {
          tokens: kbResponse.usage?.total_tokens || 0, latency,
          cost: calculateCost(model, kbResponse.usage?.prompt_tokens || 0, kbResponse.usage?.completion_tokens || 0)
        }
        setResponse(kbResponse.answer)
        setRagContext(kbResponse.sources || [])
        setStats(newStats)
        setMessages(prev => [...prev, {
          role: 'assistant', content: kbResponse.answer, timestamp: new Date(),
          model, stats: newStats, mode: 'rag', sources: kbResponse.sources || []
        }])
        refreshDashboard()
        return
      }

      // Agent mode — streamed
      if (agentMode && selectedAgentId) {
        const agent = getSelectedAgent()
        setAgentStreaming(true)
        setStreamPhase('init')
        setLiveSteps([])
        setStreamingAnswer('')
        setActiveToolCall(null)

        const stream = agentsApi.invokeStream(selectedAgentId, {
          message: userMsg,
          session_id: agentSessionId,
        })
        streamAbortRef.current = stream

        let finalData = null
        let answerSoFar = ''

        try {
          for await (const { event, data } of stream) {
            switch (event) {
              case 'status':
                setStreamPhase(data.phase || 'init')
                break
              case 'thinking':
                setStreamPhase('reasoning')
                break
              case 'tool_start':
                setActiveToolCall({ tool: data.tool, input: data.tool_input, thought: data.thought })
                break
              case 'tool_result':
                setActiveToolCall(null)
                break
              case 'step':
                setLiveSteps(prev => [...prev, data])
                break
              case 'answer_delta':
                answerSoFar += data.chunk
                setStreamingAnswer(answerSoFar)
                setStreamPhase('answering')
                break
              case 'done':
                finalData = data
                break
              case 'error':
                setError(data.message || 'Agent streaming error')
                setMessages(prev => [...prev, { role: 'error', content: data.message, timestamp: new Date() }])
                break
              default:
                break
            }
          }
        } catch (streamErr) {
          if (streamErr.name !== 'AbortError') {
            console.error('Stream error:', streamErr)
            setError(streamErr.message || 'Agent streaming failed')
          }
        }

        // Finalize
        setAgentStreaming(false)
        setStreamPhase('')
        setActiveToolCall(null)

        if (finalData) {
          setAgentSessionId(finalData.session_id || null)
          const endTime = Date.now()
          const latency = ((endTime - startTime) / 1000).toFixed(2)
          const costDisplay = finalData.cost?.is_free ? 'FREE' : `₹${finalData.cost?.billed_cost_inr?.toFixed(4) || '0'}`
          const newStats = {
            tokens: finalData.usage?.total_tokens || 0, latency,
            cost: costDisplay
          }
          setResponse(finalData.answer)
          setStats(newStats)
          setStreamingAnswer('')
          setMessages(prev => [...prev, {
            role: 'assistant', content: finalData.answer, timestamp: new Date(),
            model: agent?.model || 'agent', stats: newStats, mode: 'agent',
            agentSteps: finalData.steps, agentCost: finalData.cost,
            agentLatency: finalData.latency_ms,
            memoryEnabled: finalData.memory_enabled || false,
          }])
          refreshDashboard()
        }
        return
      }

      // Standard chat mode — send full conversation history
      const chatHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      chatHistory.push({ role: 'user', content: userMsg })

      const payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory
        ],
        max_tokens: parseInt(maxTokens), temperature, top_p: topP, stream: false
      }
      setLastPayload(payload)
      const res = await completionsApi.create(payload)
      const data = res.data
      const endTime = Date.now()
      const latency = ((endTime - startTime) / 1000).toFixed(2)
      const newStats = {
        tokens: data.usage?.total_tokens || 0, latency,
        cost: calculateCost(model, data.usage?.prompt_tokens || 0, data.usage?.completion_tokens || 0)
      }
      const assistantContent = data.choices[0].message.content
      setResponse(assistantContent)
      setStats(newStats)
      setMessages(prev => [...prev, {
        role: 'assistant', content: assistantContent, timestamp: new Date(),
        model, stats: newStats, mode: 'chat'
      }])
      refreshDashboard()
    } catch (err) {
      console.error(err)
      const errMsg = err.response?.data?.detail || "Generation failed"
      // Check if this is a quota exceeded error (429)
      if (err.response?.status === 429) {
        const quotaMsg = 'Daily limit reached. Free tier is closed for today — please deposit money to use the Pro plan.'
        notify('error', quotaMsg)
        setError(quotaMsg)
        setMessages(prev => [...prev, { role: 'error', content: quotaMsg, timestamp: new Date() }])
      } else {
        setError(errMsg)
        setMessages(prev => [...prev, { role: 'error', content: errMsg, timestamp: new Date() }])
      }
    } finally {
      setLoading(false)
      setRagSearching(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && !agentStreaming && model && userMessage.trim()) handleGenerate()
    }
  }

  const handleClearChat = () => {
    setMessages([])
    setResponse('')
    setRagContext([])
    setError('')
    setStats({ tokens: 0, latency: 0, cost: 0 })
    setDocFile(null)
    setAgentSessionId(null)
    // Reset streaming state
    if (streamAbortRef.current) {
      try { streamAbortRef.current.abort() } catch {}
    }
    setAgentStreaming(false)
    setStreamPhase('')
    setLiveSteps([])
    setStreamingAnswer('')
    setActiveToolCall(null)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getActiveMode = () => {
    if (agentMode) return 'agent'
    if (docFile) return 'document'
    if (ragEnabled) return 'rag'
    return 'chat'
  }

  const getModeLabel = () => {
    const mode = getActiveMode()
    if (mode === 'agent') {
      const agent = getSelectedAgent()
      return agent ? `Agent: ${agent.name}` : 'Agent'
    }
    if (mode === 'document') return 'Document Q&A'
    if (mode === 'rag') return 'Knowledge Base'
    return 'Chat'
  }

  const getModeColor = () => {
    const mode = getActiveMode()
    if (mode === 'agent') return '#10b981'
    if (mode === 'document') return 'var(--info)'
    if (mode === 'rag') return 'var(--success)'
    return 'var(--primary)'
  }

  return (
    <div className="content-area">
      <div className="pg-layout">
        {/* ═══════ CONFIG SIDEBAR ═══════ */}
        <aside className={`pg-sidebar ${configCollapsed ? 'pg-sidebar--collapsed' : ''}`}>
          <div className="pg-sidebar__header">
            <div className="pg-sidebar__title">
              <Settings2 size={16} />
              <span>Configuration</span>
            </div>
            <button 
              className="pg-sidebar__toggle"
              onClick={() => setConfigCollapsed(!configCollapsed)}
              title={configCollapsed ? 'Expand' : 'Collapse'}
            />
          </div>

          {!configCollapsed && (
            <div className="pg-sidebar__body">
              {/* Model Selector */}
              <div className="pg-field">
                <label className="pg-field__label">
                  <Cpu size={13} />
                  Model
                </label>
                <div className="pg-select-wrap">
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="pg-select">
                    {modelsList.length > 0 ? (
                      <>
                        {modelsList.filter(m => isFreeTier(m)).length > 0 && (
                          <optgroup label="Free Tier">
                            {modelsList.filter(m => isFreeTier(m)).map((m) => (
                              <option key={m} value={m}>{getModelLabel(m)}</option>
                            ))}
                          </optgroup>
                        )}
                        {modelsList.filter(m => !isFreeTier(m)).length > 0 && (
                          <optgroup label="Premium">
                            {modelsList.filter(m => !isFreeTier(m)).map((m) => (
                              <option key={m} value={m}>{getModelLabel(m)}</option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      <option>Loading...</option>
                    )}
                  </select>
                  <ChevronDown className="pg-select__icon" size={14} />
                </div>
                {model && (
                  <div className="pg-model-badge">
                    {isFreeTier(model) ? (
                      currentTier === 'paid' ? (
                        <span className="pg-badge pg-badge--premium" title="Using paid keys (full speed)">
                          <Zap size={11} /> Paid — Full Speed
                        </span>
                      ) : (
                        <span className="pg-badge pg-badge--free" title="Using shared keys (delayed)">
                          <Clock size={11} /> Free — Delayed
                        </span>
                      )
                    ) : (
                      <span className="pg-badge pg-badge--premium">Premium</span>
                    )}
                  </div>
                )}
                {currentTier === 'free' && model && (
                  <div className="pg-tier-banner" style={{
                    marginTop: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <Clock size={12} style={{ color: '#f59e0b' }} />
                    Free tier has 3-5s response delay. Deposit money for instant responses.
                  </div>
                )}
              </div>

              <div className="pg-divider" />

              {/* Parameters */}
              <div className="pg-field">
                <label className="pg-field__label">
                  <Thermometer size={13} />
                  Temperature
                  <span className="pg-field__value">{temperature}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="pg-slider"
                  style={{ '--pg-progress': `${temperature * 100}%` }}
                />
                <div className="pg-slider__labels">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <div className="pg-field">
                <label className="pg-field__label">
                  <SlidersHorizontal size={13} />
                  Top P
                  <span className="pg-field__value">{topP}</span>
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="pg-slider"
                  style={{ '--pg-progress': `${topP * 100}%` }}
                />
              </div>

              <div className="pg-field">
                <label className="pg-field__label">
                  <Hash size={13} />
                  Max Tokens
                </label>
                <input
                  type="number" value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="pg-input" min="1" max="32000"
                />
              </div>

              <div className="pg-divider" />

              {/* System Prompt */}
              <div className="pg-field">
                <label className="pg-field__label">
                  <BookOpen size={13} />
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="pg-textarea" rows="3"
                  placeholder="You are a helpful AI assistant."
                />
              </div>

              <div className="pg-divider" />

              {/* Feature Toggles */}
              <div className="pg-field">
                <span className="pg-field__section-label">Features</span>
              </div>

              {/* RAG Toggle */}
              <label className={`pg-toggle ${ragEnabled ? 'pg-toggle--active' : ''}`}>
                <div className="pg-toggle__info">
                  <Database size={15} />
                  <div>
                    <span className="pg-toggle__title">Knowledge Base</span>
                    <span className="pg-toggle__desc">RAG-powered answers</span>
                  </div>
                </div>
                <div className={`pg-switch ${ragEnabled ? 'pg-switch--on' : ''}`} onClick={(e) => {
                  e.preventDefault()
                  setRagEnabled(!ragEnabled)
                  if (!ragEnabled) setDocFile(null)
                }}>
                  <div className="pg-switch__thumb" />
                </div>
              </label>

              {ragEnabled && (
                <div className="pg-nested-config">
                  <div className="pg-field">
                    <label className="pg-field__label">Knowledge Base</label>
                    <div className="pg-select-wrap">
                      <select 
                        value={selectedKB} 
                        onChange={(e) => setSelectedKB(e.target.value)}
                        className="pg-select"
                        disabled={knowledgeBases.length === 0}
                      >
                        <option value="">Select...</option>
                        {knowledgeBases.map((kb) => (
                          <option key={kb.id} value={kb.id}>
                            {kb.name} ({kb.document_count} docs)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pg-select__icon" size={14} />
                    </div>
                  </div>
                  <div className="pg-field-row">
                    <div className="pg-field pg-field--half">
                      <label className="pg-field__label">Top K</label>
                      <input type="number" value={ragTopK} onChange={(e) => setRagTopK(parseInt(e.target.value))} className="pg-input" min={1} max={20} />
                    </div>
                    <div className="pg-field pg-field--half">
                      <label className="pg-field__label">Chunks</label>
                      <input type="number" value={ragMaxChunks} onChange={(e) => setRagMaxChunks(parseInt(e.target.value))} className="pg-input" min={1} max={10} />
                    </div>
                  </div>
                </div>
              )}

              {/* Document Upload Toggle */}
              <label className={`pg-toggle ${docFile ? 'pg-toggle--active pg-toggle--doc' : ''}`}>
                <div className="pg-toggle__info">
                  <FileText size={15} />
                  <div>
                    <span className="pg-toggle__title">Document Q&A</span>
                    <span className="pg-toggle__desc">Upload & analyze files</span>
                  </div>
                </div>
                <button 
                  className="pg-upload-btn"
                  onClick={(e) => {
                    e.preventDefault()
                    if (docFile) { setDocFile(null) }
                    else { fileInputRef.current?.click(); setRagEnabled(false) }
                  }}
                >
                  {docFile ? <X size={14} /> : <Upload size={14} />}
                  {docFile ? 'Remove' : 'Upload'}
                </button>
              </label>
              <input
                ref={fileInputRef} type="file"
                accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.html,.htm,.md,.json,.xml,.pptx"
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) { setDocFile(e.target.files[0]); setRagEnabled(false) } }}
              />
              {docFile && (
                <div className="pg-doc-chip">
                  <FileText size={14} />
                  <span className="pg-doc-chip__name">{docFile.name}</span>
                  <span className="pg-doc-chip__size">{(docFile.size / 1024).toFixed(0)} KB</span>
                </div>
              )}

              {/* Guardrails Toggle */}
              <label className={`pg-toggle ${guardrailsEnabled ? 'pg-toggle--active pg-toggle--guard' : ''}`}>
                <div className="pg-toggle__info">
                  <Shield size={15} />
                  <div>
                    <span className="pg-toggle__title">Guardrails</span>
                    <span className="pg-toggle__desc">PII filtering & safety</span>
                  </div>
                </div>
                <div className={`pg-switch ${guardrailsEnabled ? 'pg-switch--on' : ''}`} onClick={(e) => {
                  e.preventDefault()
                  setGuardrailsEnabled(!guardrailsEnabled)
                }}>
                  <div className="pg-switch__thumb" />
                </div>
              </label>

              <div className="pg-divider" />

              {/* Agent Mode Toggle */}
              <label className={`pg-toggle ${agentMode ? 'pg-toggle--active pg-toggle--agent' : ''}`}>
                <div className="pg-toggle__info">
                  <Bot size={15} />
                  <div>
                    <span className="pg-toggle__title">Agent Mode</span>
                    <span className="pg-toggle__desc">Multi-step reasoning</span>
                  </div>
                </div>
                <div className={`pg-switch ${agentMode ? 'pg-switch--on' : ''}`} onClick={(e) => {
                  e.preventDefault()
                  const next = !agentMode
                  setAgentMode(next)
                  if (next) { setRagEnabled(false); setDocFile(null); setAgentSessionId(null) }
                }}>
                  <div className="pg-switch__thumb" />
                </div>
              </label>

              {agentMode && (
                <div className="pg-nested-config">
                  <div className="pg-field">
                    <label className="pg-field__label">Agent</label>
                    <div className="pg-select-wrap">
                      <select 
                        value={selectedAgentId}
                        onChange={(e) => { setSelectedAgentId(e.target.value); setAgentSessionId(null) }}
                        className="pg-select"
                        disabled={agentsList.length === 0}
                      >
                        <option value="">Select an agent...</option>
                        {agentsList.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.icon || '🤖'} {agent.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pg-select__icon" size={14} />
                    </div>
                  </div>
                  {selectedAgentId && (() => {
                    const agent = getSelectedAgent()
                    return agent ? (
                      <div className="pg-agent-info">
                        <div className="pg-agent-info__tools">
                          {(agent.tools || []).map(t => (
                            <span key={t} className="pg-agent-tool-chip">
                              <Wrench size={10} />{t.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                        <div className="pg-agent-info__meta">
                          <span><Cpu size={11} />{agent.model.replace(/-/g, ' ')}</span>
                          {agent.pricing?.is_free 
                            ? <span className="pg-badge pg-badge--free">Free</span>
                            : <span className="pg-badge pg-badge--premium">+45% markup</span>}
                        </div>
                        <div className="pg-agent-info__memory">
                          {agent.pricing?.is_free ? (
                            <span className="pg-memory pg-memory--off" title="Free tier agents are stateless — each message is independent">
                              <Clock size={11} /> No memory (stateless)
                            </span>
                          ) : (
                            <span className="pg-memory pg-memory--on" title="Paid agents have multi-turn conversation memory">
                              <Database size={11} /> Memory enabled
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ═══════ MAIN CHAT AREA ═══════ */}
        <main className="pg-main">
          {/* Top Bar */}
          <div className="pg-topbar">
            <div className="pg-topbar__left">
              <div className="pg-mode-indicator" style={{ '--mode-color': getModeColor() }}>
                {getActiveMode() === 'agent' && <Bot size={14} />}
                {getActiveMode() === 'document' && <FileText size={14} />}
                {getActiveMode() === 'rag' && <Database size={14} />}
                {getActiveMode() === 'chat' && <MessageSquare size={14} />}
                <span>{getModeLabel()}</span>
              </div>
              {model && (
                <div className="pg-topbar__model">
                  <Cpu size={13} />
                  <span>{getModelLabel(model)}</span>
                </div>
              )}
            </div>
            <div className="pg-topbar__right">
              {messages.length > 0 && (
                <>
                  <div className="pg-topbar__stats">
                    {stats.tokens > 0 && (
                      <span className="pg-stat"><Layers size={12} />{stats.tokens} tokens</span>
                    )}
                    {stats.latency > 0 && (
                      <span className="pg-stat"><Clock size={12} />{stats.latency}s</span>
                    )}
                    {stats.cost && (
                      <span className="pg-stat pg-stat--cost"><Coins size={12} />{stats.cost}</span>
                    )}
                  </div>
                  <button className="pg-btn-icon" onClick={handleClearChat} title="Clear conversation">
                    <RotateCcw size={15} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="pg-messages">
            {messages.length === 0 ? (
              <div className="pg-empty">
                <div className="pg-empty__icon">
                  <Sparkles size={32} />
                </div>
                <h3>InferX Playground</h3>
                <p>Test models, upload documents, and query knowledge bases — all in one place.</p>
                <div className="pg-empty__hints">
                  <button className="pg-hint" onClick={() => setUserMessage('Explain quantum computing in simple terms')}>
                    <Zap size={14} />
                    Explain quantum computing
                  </button>
                  <button className="pg-hint" onClick={() => setUserMessage('Write a Python function to sort a list using merge sort')}>
                    <Code size={14} />
                    Write a merge sort function
                  </button>
                  <button className="pg-hint" onClick={() => setUserMessage('Compare REST and GraphQL APIs with pros and cons')}>
                    <Layers size={14} />
                    Compare REST vs GraphQL
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`pg-msg pg-msg--${msg.role}`}>
                    <div className="pg-msg__avatar">
                      {msg.role === 'user' ? <User size={16} /> : msg.role === 'error' ? <AlertCircle size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="pg-msg__body">
                      <div className="pg-msg__header">
                        <span className="pg-msg__role">
                          {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'InferX'}
                        </span>
                        {msg.model && <span className="pg-msg__model">{getModelLabel(msg.model)}</span>}
                        {msg.mode && (
                          <span className={`pg-msg__mode pg-msg__mode--${msg.mode}`}>
                            {msg.mode === 'agent' ? 'Agent' : msg.mode === 'rag' ? 'RAG' : msg.mode === 'document' ? 'Doc' : 'Chat'}
                          </span>
                        )}
                      </div>
                      {msg.docName && (
                        <div className="pg-msg__doc">
                          <FileText size={13} />
                          <span>{msg.docName}</span>
                          <span className="pg-msg__doc-size">{(msg.docSize / 1024).toFixed(0)} KB</span>
                        </div>
                      )}
                      <div className="pg-msg__content">
                        <MarkdownContent content={msg.content} />
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pg-msg__sources">
                          <span className="pg-msg__sources-label">
                            <Database size={12} />
                            {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''} used
                          </span>
                        </div>
                      )}
                      {msg.mode === 'agent' && msg.memoryEnabled !== undefined && (
                        <div className="pg-msg__memory-badge">
                          {msg.memoryEnabled ? (
                            <span className="pg-memory pg-memory--on"><Database size={11} /> Memory active</span>
                          ) : (
                            <span className="pg-memory pg-memory--off"><Clock size={11} /> Stateless</span>
                          )}
                        </div>
                      )}
                      {msg.agentSteps && msg.agentSteps.length > 1 && (
                        <details className="pg-agent-steps">
                          <summary>
                            <Zap size={13} />
                            <span>{msg.agentSteps.length} reasoning steps</span>
                            {msg.agentLatency && <span className="pg-agent-steps__latency">{msg.agentLatency}ms</span>}
                            <ChevronDown size={13} className="pg-agent-steps__chevron" />
                          </summary>
                          <div className="pg-agent-steps__list">
                            {msg.agentSteps.map((s, si) => (
                              <div key={si} className={`pg-agent-step pg-agent-step--${s.type}`}>
                                <div className="pg-agent-step__head">
                                  <span className="pg-agent-step__num">#{s.step}</span>
                                  {s.type === 'tool_call'
                                    ? <span className="pg-agent-step__tool">
                                        <Wrench size={11} />
                                        {s.tool}
                                        {s.tool === 'delegate_to_agent' && <span style={{marginLeft:4,opacity:0.7,fontSize:'0.8em'}}>→ sub-agent</span>}
                                        {s.parsed_from_text && <span style={{marginLeft:4,opacity:0.5,fontSize:'0.75em'}}>(text-parsed)</span>}
                                      </span>
                                    : <span className="pg-agent-step__final">Final Answer</span>}
                                </div>
                                {s.type === 'tool_call' && s.thought && (
                                  <div className="pg-agent-step__thought">{s.thought.substring(0, 200)}</div>
                                )}
                                {s.type === 'tool_call' && s.tool_output && (
                                  <div className="pg-agent-step__output">{s.tool_output.substring(0, 500)}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {msg.role === 'assistant' && (
                        <div className="pg-msg__actions">
                          <button onClick={() => copyToClipboard(msg.content)} className="pg-msg__action" title="Copy">
                            {copied ? <Check size={13} /> : <Copy size={13} />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                          {msg.stats && (
                            <span className="pg-msg__stats">
                              {msg.stats.tokens > 0 && <span>{msg.stats.tokens} tok</span>}
                              {msg.stats.latency > 0 && <span>{msg.stats.latency}s</span>}
                              {msg.stats.cost && <span>{msg.stats.cost}</span>}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Live Agent Streaming Indicator */}
                {agentStreaming && (
                  <div className="pg-msg pg-msg--assistant pg-msg--streaming">
                    <div className="pg-msg__avatar"><Bot size={16} /></div>
                    <div className="pg-msg__body">
                      {/* Phase indicator */}
                      <div className="pg-stream-phase">
                        <div className={`pg-stream-pulse ${streamPhase}`} />
                        <span className="pg-stream-phase__label">
                          {streamPhase === 'init' ? 'Loading agent…' :
                           streamPhase === 'reasoning' ? 'Reasoning…' :
                           streamPhase === 'answering' ? 'Writing answer…' : 'Thinking…'}
                        </span>
                      </div>

                      {/* Live steps */}
                      {liveSteps.length > 0 && (
                        <div className="pg-live-steps">
                          {liveSteps.map((s, i) => (
                            <div key={i} className={`pg-live-step pg-live-step--${s.type} pg-live-step--done`}>
                              <div className="pg-live-step__head">
                                <span className="pg-live-step__num">#{s.step}</span>
                                {s.type === 'tool_call'
                                  ? <span className="pg-live-step__tool">
                                      <Wrench size={11} />
                                      {s.tool}
                                      {s.tool === 'delegate_to_agent' && <span className="pg-live-step__sub">→ sub-agent</span>}
                                    </span>
                                  : <span className="pg-live-step__final">Final Answer</span>}
                                <Check size={11} className="pg-live-step__check" />
                              </div>
                              {s.type === 'tool_call' && s.tool_output && (
                                <div className="pg-live-step__output">{s.tool_output.substring(0, 200)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active tool call */}
                      {activeToolCall && (
                        <div className="pg-live-step pg-live-step--active">
                          <div className="pg-live-step__head">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="pg-live-step__tool">
                              <Wrench size={11} />
                              {activeToolCall.tool}
                            </span>
                            <span className="pg-live-step__running">running…</span>
                          </div>
                          {activeToolCall.thought && (
                            <div className="pg-live-step__thought">{activeToolCall.thought.substring(0, 200)}</div>
                          )}
                        </div>
                      )}

                      {/* Streamed answer preview */}
                      {streamingAnswer && (
                        <div className="pg-stream-answer">
                          <span className="pg-stream-answer__text">{streamingAnswer}</span>
                          <span className="pg-stream-cursor" />
                        </div>
                      )}

                      {/* Fallback dots when no steps yet and not answering */}
                      {!streamingAnswer && liveSteps.length === 0 && !activeToolCall && (
                        <div className="pg-typing"><span /><span /><span /></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-agent loading indicator */}
                {loading && !agentStreaming && (
                  <div className="pg-msg pg-msg--assistant pg-msg--loading">
                    <div className="pg-msg__avatar"><Bot size={16} /></div>
                    <div className="pg-msg__body">
                      <div className="pg-typing"><span /><span /><span /></div>
                      <span className="pg-typing__label">
                        {docProcessing ? 'Processing document...' : ragSearching ? 'Searching knowledge base...' : 'Generating...'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="pg-input-area">
            {error && (
              <div className="pg-error">
                <AlertCircle size={14} />
                {error}
                <button onClick={() => setError('')}><X size={12} /></button>
              </div>
            )}
            <div className="pg-composer">
              <textarea
                ref={textareaRef}
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agentMode ? `Message ${getSelectedAgent()?.name || 'agent'}... (Enter to send)` : docFile ? `Ask about ${docFile.name}...` : ragEnabled ? 'Ask your knowledge base...' : 'Type a message... (Enter to send, Shift+Enter for new line)'}
                className="pg-composer__input"
                rows="1"
                disabled={loading || agentStreaming}
              />
              <div className="pg-composer__footer">
                <div className="pg-composer__features">
                  {docFile && (
                    <span className="pg-chip pg-chip--doc">
                      <FileText size={12} />{docFile.name}
                      <button onClick={() => setDocFile(null)}><X size={10} /></button>
                    </span>
                  )}
                  {ragEnabled && <span className="pg-chip pg-chip--rag"><Database size={12} />RAG</span>}
                  {agentMode && <span className="pg-chip pg-chip--agent"><Bot size={12} />{getSelectedAgent()?.name || 'Agent'}</span>}
                  {guardrailsEnabled && <span className="pg-chip pg-chip--guard"><Shield size={12} />Safe</span>}
                </div>
                <button 
                  onClick={handleGenerate} 
                  disabled={loading || agentStreaming || (!agentMode && !model) || (!userMessage.trim() && !docFile) || (ragEnabled && !selectedKB) || (agentMode && !selectedAgentId)} 
                  className="pg-send-btn"
                  title="Send message"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Playground
