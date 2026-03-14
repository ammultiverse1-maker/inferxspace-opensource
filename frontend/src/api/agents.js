/**
 * Agents API — Frontend client for the InferX Agent framework.
 */
import api from './client';

/** Parse a single SSE event block (may have `event:` and `data:` lines) */
function parseSSE(raw) {
  let event = 'message';
  let dataStr = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) dataStr = line.slice(6);
  }
  if (!dataStr) return null;
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: dataStr };
  }
}

export const agentsApi = {
  // Agent CRUD
  list: () => api.get('/v1/agents'),
  get: (id) => api.get(`/v1/agents/${id}`),
  create: (data) => api.post('/v1/agents', data),
  update: (id, data) => api.put(`/v1/agents/${id}`, data),
  delete: (id) => api.delete(`/v1/agents/${id}`),

  // Templates
  listTemplates: () => api.get('/v1/agents/templates'),
  createFromTemplate: (data) => api.post('/v1/agents/from-template', data),

  // Tools
  listTools: () => api.get('/v1/agents/tools'),

  // Sessions
  listSessions: (agentId) => api.get(`/v1/agents/${agentId}/sessions`),
  getSessionMessages: (agentId, sessionId) =>
    api.get(`/v1/agents/${agentId}/sessions/${sessionId}/messages`),

  // Cost estimate
  costEstimate: (agentId) => api.get(`/v1/agents/${agentId}/cost-estimate`),

  // Invoke
  invoke: (agentId, data) => api.post(`/v1/agents/${agentId}/invoke`, data),

  /**
   * Streaming invoke — returns an object with an async iterator.
   * Usage:
   *   const stream = agentsApi.invokeStream(agentId, { message, session_id });
   *   for await (const event of stream) {
   *     // event = { event: 'status'|'thinking'|'tool_start'|'tool_result'|'answer_delta'|'step'|'done'|'error', data: {...} }
   *   }
   */
  invokeStream: (agentId, data) => {
    const baseURL = import.meta.env.VITE_API_URL || 'https://api.inferx.space';
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];

    const controller = new AbortController();

    const iterator = {
      [Symbol.asyncIterator]() {
        let reader = null;
        let buffer = '';
        let done = false;

        const init = async () => {
          const res = await fetch(`${baseURL}/v1/agents/${agentId}/invoke/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify(data),
            signal: controller.signal,
          });
          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(errBody || `HTTP ${res.status}`);
          }
          reader = res.body.getReader();
        };

        const readNext = async () => {
          if (!reader) await init();

          while (true) {
            // Try to extract a complete event from the buffer
            const eventEnd = buffer.indexOf('\n\n');
            if (eventEnd !== -1) {
              const raw = buffer.slice(0, eventEnd);
              buffer = buffer.slice(eventEnd + 2);
              const parsed = parseSSE(raw);
              if (parsed) return { value: parsed, done: false };
              continue;
            }

            // Read more data
            const { value, done: streamDone } = await reader.read();
            if (streamDone) {
              done = true;
              // Process any remaining buffer
              if (buffer.trim()) {
                const parsed = parseSSE(buffer.trim());
                buffer = '';
                if (parsed) return { value: parsed, done: false };
              }
              return { value: undefined, done: true };
            }
            buffer += new TextDecoder().decode(value);
          }
        };

        return { next: readNext };
      },
      abort: () => controller.abort(),
    };

    return iterator;
  },

  // Clone, Export, Import
  clone: (agentId, data = {}) => api.post(`/v1/agents/${agentId}/clone`, data),
  export: (agentId) => api.get(`/v1/agents/${agentId}/export`),
  import: (config) => api.post('/v1/agents/import', { config }),
};

export default agentsApi;
