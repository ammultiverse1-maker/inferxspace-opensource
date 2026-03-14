/**
 * Platform Services API — Bedrock-style services
 * Document Processing, Guardrails, Prompts, Batch, Agents, Evaluate
 */

import api from './client'

// ============================================================================
// Document Processing
// ============================================================================

export const documentsApi = {
  /** List supported document formats */
  getFormats: () => api.get('/v1/documents/formats'),

  /** Extract text from a document (no LLM call) */
  extract: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/v1/documents/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Upload doc + process with LLM in one call */
  process: (file, { prompt, model, systemPrompt, temperature, maxTokens } = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    if (prompt) formData.append('prompt', prompt)
    if (model) formData.append('model', model)
    if (systemPrompt) formData.append('system_prompt', systemPrompt)
    if (temperature !== undefined) formData.append('temperature', String(temperature))
    if (maxTokens !== undefined) formData.append('max_tokens', String(maxTokens))
    return api.post('/v1/documents/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
}

// ============================================================================
// Guardrails
// ============================================================================

export const guardrailsApi = {
  /** List guardrail configs */
  listConfigs: () => api.get('/v1/guardrails/configs'),

  /** Create a guardrail config */
  createConfig: (config) => api.post('/v1/guardrails/configs', config),

  /** Get a guardrail config */
  getConfig: (name) => api.get(`/v1/guardrails/configs/${name}`),

  /** Delete a guardrail config */
  deleteConfig: (name) => api.delete(`/v1/guardrails/configs/${name}`),

  /** Quick safety check */
  check: (text, configName = 'default') =>
    api.post('/v1/guardrails/check', { text, config_name: configName }),

  /** Apply input guardrails */
  applyInput: (text, configName = 'default') =>
    api.post('/v1/guardrails/apply-input', { text, config_name: configName }),

  /** Apply output guardrails */
  applyOutput: (text, configName = 'default') =>
    api.post('/v1/guardrails/apply-output', { text, config_name: configName }),
}

// ============================================================================
// Prompt Management
// ============================================================================

export const promptsApi = {
  /** Create a prompt template */
  create: (data) => api.post('/v1/prompts', data),

  /** List prompt templates */
  list: (tag) => api.get('/v1/prompts', { params: tag ? { tag } : {} }),

  /** Get a prompt template */
  get: (id, includeVersions = false) =>
    api.get(`/v1/prompts/${id}`, { params: { include_versions: includeVersions } }),

  /** Update a prompt template */
  update: (id, data) => api.patch(`/v1/prompts/${id}`, data),

  /** Delete a prompt template */
  delete: (id) => api.delete(`/v1/prompts/${id}`),

  /** Render a prompt with variables */
  render: (id, variables) => api.post(`/v1/prompts/${id}/render`, { variables }),

  /** Render + invoke LLM */
  invoke: (id, { variables, model, temperature, maxTokens } = {}) =>
    api.post(`/v1/prompts/${id}/invoke`, {
      variables: variables || {},
      model,
      temperature,
      max_tokens: maxTokens,
    }),

  /** List versions */
  listVersions: (id) => api.get(`/v1/prompts/${id}/versions`),
}

// ============================================================================
// Batch Inference
// ============================================================================

export const batchApi = {
  /** Create a batch job */
  createJob: (data) => api.post('/v1/batch/jobs', data),

  /** List batch jobs */
  listJobs: () => api.get('/v1/batch/jobs'),

  /** Get job status */
  getJob: (jobId) => api.get(`/v1/batch/jobs/${jobId}`),

  /** Get job results */
  getResults: (jobId) => api.get(`/v1/batch/jobs/${jobId}/results`),

  /** Cancel a job */
  cancelJob: (jobId) => api.post(`/v1/batch/jobs/${jobId}/cancel`),
}

// ============================================================================
// Model Evaluation
// ============================================================================

export const evaluateApi = {
  /** Run model comparison */
  evaluate: (data) => api.post('/v1/evaluate', data),

  /** Get evaluation history */
  history: () => api.get('/v1/evaluate/history'),
}

// ============================================================================
// MCP Servers
// ============================================================================

export const mcpApi = {
  /** Register a new MCP server */
  registerServer: (data) => api.post('/v1/mcp/servers', data),

  /** List registered servers */
  listServers: () => api.get('/v1/mcp/servers'),

  /** Get server details including tools */
  getServer: (id) => api.get(`/v1/mcp/servers/${id}`),

  /** Remove a server */
  unregisterServer: (id) => api.delete(`/v1/mcp/servers/${id}`),

  /** Connect to server (initialize + discover tools) */
  connectServer: (id) => api.post(`/v1/mcp/servers/${id}/connect`),

  /** Refresh tool list */
  refreshTools: (id) => api.post(`/v1/mcp/servers/${id}/refresh`),

  /** Ping / health check */
  pingServer: (id) => api.post(`/v1/mcp/servers/${id}/ping`),

  /** Call a specific tool */
  callTool: (serverId, data) => api.post(`/v1/mcp/servers/${serverId}/call`, data),

  /** List all tools across all connected servers */
  listAllTools: () => api.get('/v1/mcp/tools'),
}
