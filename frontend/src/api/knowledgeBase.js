/**
 * Knowledge Base API client
 */

import apiClient from './client'

export const knowledgeBaseAPI = {
  // Knowledge Base CRUD
  async createKnowledgeBase(data) {
    const response = await apiClient.post('/v1/knowledge-bases', data)
    return response.data
  },

  async listKnowledgeBases() {
    const response = await apiClient.get('/v1/knowledge-bases')
    return response.data
  },

  async getKnowledgeBase(kbId) {
    const response = await apiClient.get(`/v1/knowledge-bases/${kbId}`)
    return response.data
  },

  async updateKnowledgeBase(kbId, data) {
    const response = await apiClient.patch(`/v1/knowledge-bases/${kbId}`, data)
    return response.data
  },

  async deleteKnowledgeBase(kbId) {
    await apiClient.delete(`/v1/knowledge-bases/${kbId}`)
  },

  // Document Management
  async uploadDocument(kbId, file, metadata = {}) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('metadata', JSON.stringify(metadata))

    const response = await apiClient.post(
      `/v1/knowledge-bases/${kbId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  async listDocuments(kbId) {
    const response = await apiClient.get(`/v1/knowledge-bases/${kbId}/documents`)
    return response.data
  },

  async deleteDocument(kbId, docId) {
    await apiClient.delete(`/v1/knowledge-bases/${kbId}/documents/${docId}`)
  },

  // Query with RAG
  async queryKnowledgeBase(kbId, queryData) {
    const response = await apiClient.post(
      `/v1/knowledge-bases/${kbId}/query`,
      queryData
    )
    return response.data
  },
}
