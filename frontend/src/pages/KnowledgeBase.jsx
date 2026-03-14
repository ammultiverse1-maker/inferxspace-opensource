import { useState, useEffect } from 'react'
import { 
  Upload, FileText, Trash2, Search, AlertCircle, Check, 
  Database as DatabaseIcon, Plus, FolderOpen, X, Edit2, 
  ChevronRight, FileStack, Folder, Lock, Info
} from 'lucide-react'
import { knowledgeBaseAPI } from '../api/knowledgeBase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import './KnowledgeBase.css'

const KnowledgeBase = () => {
  const { user } = useAuth()
  const [knowledgeBases, setKnowledgeBases] = useState([])
  const isFreeTier = !user?.credit_balance || parseFloat(user.credit_balance) <= 0
  const FREE_KB_LIMIT = 1
  const FREE_STORAGE_MB = 500
  const [selectedKB, setSelectedKB] = useState(null)
  const [showCreateKB, setShowCreateKB] = useState(false)
  const [kbForm, setKBForm] = useState({
    name: '',
    description: '',
    embedding_model: 'all-MiniLM-L6-v2',
    chunk_size: 512,
    chunk_overlap: 64,
  })
  
  const [kbDocuments, setKBDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadKnowledgeBases()
  }, [])

  useEffect(() => {
    if (selectedKB) {
      loadKBDocuments(selectedKB.id)
    }
  }, [selectedKB])

  const loadKnowledgeBases = async () => {
    try {
      const data = await knowledgeBaseAPI.listKnowledgeBases()
      setKnowledgeBases(data.knowledge_bases || [])
      if (data.knowledge_bases?.length > 0 && !selectedKB) {
        setSelectedKB(data.knowledge_bases[0])
      }
    } catch (err) {
      console.error('Failed to load knowledge bases:', err)
    }
  }

  const loadKBDocuments = async (kbId) => {
    try {
      const data = await knowledgeBaseAPI.listDocuments(kbId)
      setKBDocuments(data.documents || [])
    } catch (err) {
      console.error('Failed to load KB documents:', err)
      setError('Failed to load documents')
    }
  }

  const handleCreateKB = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const newKB = await knowledgeBaseAPI.createKnowledgeBase(kbForm)
      setKnowledgeBases([newKB, ...knowledgeBases])
      setSelectedKB(newKB)
      setShowCreateKB(false)
      setKBForm({
        name: '',
        description: '',
        embedding_model: 'all-MiniLM-L6-v2',
        chunk_size: 512,
        chunk_overlap: 64,
      })
      setSuccess('Knowledge base created successfully!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create knowledge base')
    }
  }

  const handleDeleteKB = async (kbId) => {
    if (!confirm('Delete this knowledge base and all its documents?')) return

    try {
      await knowledgeBaseAPI.deleteKnowledgeBase(kbId)
      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== kbId))
      if (selectedKB?.id === kbId) {
        setSelectedKB(knowledgeBases[0] || null)
      }
      setSuccess('Knowledge base deleted!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const handleUploadToKB = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedKB) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      await knowledgeBaseAPI.uploadDocument(selectedKB.id, file, {
        category: 'general',
        language: 'en',
      })
      await loadKBDocuments(selectedKB.id)
      await loadKnowledgeBases()
      setSuccess(`"${file.name}" uploaded!`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Delete this document?')) return

    try {
      await knowledgeBaseAPI.deleteDocument(selectedKB.id, docId)
      await loadKBDocuments(selectedKB.id)
      await loadKnowledgeBases()
      setSuccess('Document deleted!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const filteredDocuments = kbDocuments.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="knowledge-base-container">
      <div className="kb-header">
        <div>
          <h1><DatabaseIcon size={28} /> Knowledge Bases</h1>
          <p>Organize documents into knowledge bases for RAG queries</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => setShowCreateKB(true)}
          disabled={isFreeTier && knowledgeBases.length >= FREE_KB_LIMIT}
          title={isFreeTier && knowledgeBases.length >= FREE_KB_LIMIT ? 'Free tier: 1 knowledge base limit' : ''}
        >
          <Plus size={18} /> New Knowledge Base
        </button>
      </div>

      {isFreeTier && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px', borderRadius: '8px',
          background: 'var(--bg-secondary, rgba(16, 185, 129, 0.05))',
          border: '1px solid var(--border-color, var(--border))',
          marginBottom: '16px', fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Free tier:</strong> {FREE_KB_LIMIT} knowledge base, {FREE_STORAGE_MB}MB storage. Upgrade for unlimited access.
          </span>
        </div>
      )}

      {(error || success) && (
        <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}>
          {error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{error || success}</span>
          <X size={16} onClick={() => { setError(''); setSuccess('') }} style={{ cursor: 'pointer' }} />
        </div>
      )}

      <div className="kb-layout">
        {/* Sidebar - Knowledge Base List */}
        <div className="kb-sidebar">
          <h3><Folder size={18} /> Your Knowledge Bases</h3>
          <div className="kb-list">
            {knowledgeBases.length === 0 ? (
              <div className="empty-state">
                <FolderOpen size={48} />
                <p>No knowledge bases yet</p>
                <button className="btn-secondary" onClick={() => setShowCreateKB(true)}>
                  Create Your First KB
                </button>
              </div>
            ) : (
              knowledgeBases.map(kb => (
                <div
                  key={kb.id}
                  className={`kb-item ${selectedKB?.id === kb.id ? 'active' : ''}`}
                  onClick={() => setSelectedKB(kb)}
                >
                  <div className="kb-item-header">
                    <DatabaseIcon size={16} />
                    <span className="kb-item-name">{kb.name}</span>
                  </div>
                  <div className="kb-item-stats">
                    <span>{kb.document_count} docs</span>
                    <span>•</span>
                    <span>{formatBytes(kb.total_size_bytes)}</span>
                  </div>
                  <button
                    className="kb-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteKB(kb.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content - Documents */}
        <div className="kb-main">
          {selectedKB ? (
            <>
              <div className="kb-content-header">
                <div>
                  <h2>{selectedKB.name}</h2>
                  <p>{selectedKB.description || 'No description'}</p>
                  <div className="kb-meta">
                    <span>Chunk Size: {selectedKB.chunk_size}</span>
                    <span>•</span>
                    <span>Overlap: {selectedKB.chunk_overlap}</span>
                    <span>•</span>
                    <span>Model: {selectedKB.embedding_model}</span>
                  </div>
                </div>
                <div className="kb-actions">
                  <input
                    type="file"
                    id="upload-kb-doc"
                    accept=".pdf,.txt,.docx,.doc"
                    onChange={handleUploadToKB}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="upload-kb-doc" className="btn-primary">
                    <Upload size={18} /> Upload Document
                  </label>
                </div>
              </div>

              <div className="documents-search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="documents-grid">
                {filteredDocuments.length === 0 ? (
                  <div className="empty-state">
                    <FileStack size={48} />
                    <p>No documents in this knowledge base</p>
                    <label htmlFor="upload-kb-doc" className="btn-secondary">
                      Upload First Document
                    </label>
                  </div>
                ) : (
                  filteredDocuments.map(doc => (
                    <div key={doc.id} className="document-card">
                      <div className="doc-icon">
                        <FileText size={24} />
                      </div>
                      <div className="doc-info">
                        <h4>{doc.filename}</h4>
                        <div className="doc-meta">
                          <span>{formatBytes(doc.file_size_bytes)}</span>
                          <span>•</span>
                          <span>{doc.chunk_count} chunks</span>
                          <span>•</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                        {doc.metadata?.category && (
                          <div className="doc-tags">
                            <span className="tag">{doc.metadata.category}</span>
                          </div>
                        )}
                      </div>
                      <button
                        className="doc-delete-btn"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="kb-stats-footer">
                <div className="stat-item">
                  <span className="stat-label">Total Documents</span>
                  <span className="stat-value">{selectedKB.document_count}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Size</span>
                  <span className="stat-value">{formatBytes(selectedKB.total_size_bytes)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Storage Limit</span>
                  <span className="stat-value">{formatBytes(selectedKB.max_size_bytes)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Usage</span>
                  <span className="stat-value">
                    {Math.round((selectedKB.total_size_bytes / selectedKB.max_size_bytes) * 100)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state-large">
              <DatabaseIcon size={64} />
              <h2>Select or Create a Knowledge Base</h2>
              <p>Knowledge bases organize your documents for efficient RAG queries</p>
            </div>
          )}
        </div>
      </div>

      {/* Create KB Modal */}
      <Modal
        isOpen={showCreateKB}
        onClose={() => setShowCreateKB(false)}
        title="Create Knowledge Base"
        subtitle="Organize your documents for efficient RAG queries"
        size="md"
      >
        <form onSubmit={handleCreateKB}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={kbForm.name}
              onChange={(e) => setKBForm({ ...kbForm, name: e.target.value })}
              placeholder="e.g., Customer Support Docs"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={kbForm.description}
              onChange={(e) => setKBForm({ ...kbForm, description: e.target.value })}
              placeholder="What is this knowledge base for?"
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Chunk Size</label>
              <input
                type="number"
                value={kbForm.chunk_size}
                onChange={(e) => setKBForm({ ...kbForm, chunk_size: parseInt(e.target.value) })}
                min={128}
                max={2048}
              />
            </div>
            <div className="form-group">
              <label>Chunk Overlap</label>
              <input
                type="number"
                value={kbForm.chunk_overlap}
                onChange={(e) => setKBForm({ ...kbForm, chunk_overlap: parseInt(e.target.value) })}
                min={0}
                max={512}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={() => setShowCreateKB(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Knowledge Base
            </button>
          </div>
        </form>
      </Modal>

      {uploading && (
        <div className="upload-overlay">
          <div className="upload-spinner"></div>
          <p>Uploading and processing document...</p>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase
