import './Documentation.css'
import { useState, useEffect, useRef } from 'react'
import {
  Search, Copy, Check, BookOpen, Code, Terminal, Hash,
  Zap, Key, AlertTriangle, ArrowRight, Layers, Bot,
  Database, Plug, ChevronRight
} from 'lucide-react'

const BASE = 'https://api.inferx.space'

const Documentation = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSection, setActiveSection] = useState('introduction')
  const [copiedCode, setCopiedCode] = useState(null)
  const sectionRefs = useRef({})

  /* ── scroll into view when sidebar link clicked ── */
  useEffect(() => {
    const el = sectionRefs.current[activeSection]
    if (!el) return
    const getScrollParent = (node) => {
      let p = node.parentElement
      while (p && p !== document.body) {
        const s = getComputedStyle(p)
        if (s.overflowY === 'auto' || s.overflowY === 'scroll') return p
        p = p.parentElement
      }
      return window
    }
    const sp = getScrollParent(el)
    const offset = 80
    if (sp === window) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' })
    } else {
      sp.scrollTo({ top: (el.getBoundingClientRect().top - sp.getBoundingClientRect().top) + sp.scrollTop - offset, behavior: 'smooth' })
    }
  }, [activeSection])

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
    }).catch(() => {})
  }

  /* ════════════════════════════════════════════════════════════════════
     Code snippets
  ════════════════════════════════════════════════════════════════════ */

  const snippets = {
    pythonQuick: `from openai import OpenAI

client = OpenAI(
    api_key="ix-xxxxxxxxxxxxxxxxxxxxxxxx",
    base_url="${BASE}/v1"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`,

    nodeQuick: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'ix-xxxxxxxxxxxxxxxxxxxxxxxx',
  baseURL: '${BASE}/v1',
});

const response = await client.chat.completions.create({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);`,

    curlQuick: `curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,

    chatRequest: `POST ${BASE}/v1/chat/completions
Content-Type: application/json
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx

{
  "model": "llama-3.3-70b",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain quantum computing in 3 sentences." }
  ],
  "temperature": 0.7,
  "max_tokens": 256,
  "stream": false
}`,

    chatResponse: `{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "llama-3.3-70b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Quantum computing uses qubits that can exist..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 24,
    "completion_tokens": 48,
    "total_tokens": 72
  }
}`,

    streamCurl: `curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'`,

    streamResponse: `data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"!"},"index":0}]}

data: {"id":"chatcmpl-abc","choices":[{"delta":{},"finish_reason":"stop","index":0}]}

data: [DONE]`,

    embeddingRequest: `POST ${BASE}/v1/embeddings
Content-Type: application/json
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx

{
  "model": "bge-large-en-v1.5",
  "input": "Your text to embed"
}`,

    embeddingResponse: `{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.0091, 0.0152, ...]
    }
  ],
  "model": "bge-large-en-v1.5",
  "usage": { "prompt_tokens": 5, "total_tokens": 5 }
}`,

    listModels: `GET ${BASE}/v1/models
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx`,

    createAgent: `POST ${BASE}/v1/agents
Content-Type: application/json
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx

{
  "name": "Research Assistant",
  "instructions": "You are a research assistant. Search the web to answer questions.",
  "model": "gemini-2.0-flash",
  "tools": ["web_search", "calculator"],
  "max_steps": 8,
  "temperature": 0.3
}`,

    invokeAgent: `POST ${BASE}/v1/agents/{agent_id}/invoke
Content-Type: application/json
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx

{
  "message": "What is the population of India in 2025?",
  "session_id": "sess_abc123"
}`,

    agentResponse: `{
  "answer": "India's population in 2025 is approximately 1.45 billion...",
  "steps": [
    {
      "step": 1,
      "type": "tool_call",
      "tool": "web_search",
      "tool_input": { "query": "India population 2025" },
      "tool_output": "..."
    },
    { "step": 2, "type": "answer" }
  ],
  "usage": {
    "prompt_tokens": 820,
    "completion_tokens": 195,
    "tool_calls": 1
  },
  "cost": { "billed_cost_inr": 0.0, "is_free": true },
  "latency_ms": 2340
}`,

    kbCreate: `# 1. Create a knowledge base
POST ${BASE}/v1/knowledge-bases
{ "name": "Product Docs", "description": "Company documentation" }

# 2. Upload a document (PDF, TXT, DOCX, MD)
POST ${BASE}/v1/knowledge-bases/{kb_id}/documents
Content-Type: multipart/form-data
file=@manual.pdf

# 3. Query your documents
POST ${BASE}/v1/knowledge-bases/{kb_id}/query
{ "query": "How do I reset my password?", "top_k": 5 }`,

    mcpSetup: `# 1. Register your MCP server
POST ${BASE}/v1/mcp/servers
{
  "name": "My CRM",
  "url": "https://mycrm.example.com/mcp",
  "transport": "streamable_http",
  "api_key": "your_mcp_server_key"
}

# 2. Connect — InferX discovers available tools
POST ${BASE}/v1/mcp/servers/{server_id}/connect

# 3. Attach to an agent
POST ${BASE}/v1/agents
{
  "name": "CRM Agent",
  "mcp_server_ids": ["{server_id}"],
  "tools": ["web_search"],
  "model": "gemini-2.0-flash"
}`,

    batchRequest: `POST ${BASE}/v1/batch/jobs
Content-Type: application/json
Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx

{
  "name": "Sentiment Analysis",
  "model": "llama-3.3-70b",
  "requests": [
    { "id": "r1", "messages": [{"role":"user","content":"Classify: Great product!"}] },
    { "id": "r2", "messages": [{"role":"user","content":"Classify: Poor quality."}] }
  ]
}

# Check status
GET ${BASE}/v1/batch/jobs/{job_id}

# Get results
GET ${BASE}/v1/batch/jobs/{job_id}/results`,
  }

  /* ── navigation ── */
  const navigation = {
    'Getting Started': [
      { id: 'introduction', label: 'Introduction', icon: BookOpen },
      { id: 'authentication', label: 'Authentication', icon: Key },
      { id: 'quickstart', label: 'Quick Start', icon: Zap },
    ],
    'Core API': [
      { id: 'chat-completions', label: 'Chat Completions', icon: Terminal },
      { id: 'streaming', label: 'Streaming', icon: ArrowRight },
      { id: 'embeddings', label: 'Embeddings', icon: Code },
      { id: 'models', label: 'Models', icon: Layers },
    ],
    'Platform': [
      { id: 'agents', label: 'Agents', icon: Bot },
      { id: 'knowledge-base', label: 'Knowledge Base', icon: Database },
      { id: 'mcp', label: 'MCP Servers', icon: Plug },
      { id: 'batch', label: 'Batch API', icon: Layers },
    ],
    'Reference': [
      { id: 'rate-limits', label: 'Rate Limits', icon: AlertTriangle },
      { id: 'errors', label: 'Error Codes', icon: AlertTriangle },
      { id: 'sdks', label: 'SDKs & Libraries', icon: Code },
    ],
  }

  const filteredNav = searchTerm.trim()
    ? Object.fromEntries(
        Object.entries(navigation)
          .map(([cat, items]) => [cat, items.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()))])
          .filter(([, items]) => items.length > 0)
      )
    : navigation

  /* ── reusable components ── */
  const CodeBlock = ({ code, id, lang }) => (
    <div className="dc-code">
      <div className="dc-code__bar">
        <span className="dc-code__lang">{lang}</span>
        <button className="dc-code__copy" onClick={() => handleCopy(code, id)}>
          {copiedCode === id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )

  const Callout = ({ type = 'info', children }) => (
    <div className={`dc-callout dc-callout--${type}`}>
      <span className="dc-callout__icon">{type === 'warning' ? '⚠' : type === 'tip' ? '💡' : 'ℹ'}</span>
      <div>{children}</div>
    </div>
  )

  const Endpoint = ({ method, path }) => (
    <div className="dc-endpoint">
      <span className={`dc-endpoint__method dc-endpoint__method--${method.toLowerCase()}`}>{method}</span>
      <code className="dc-endpoint__path">{path}</code>
    </div>
  )

  const ParamTable = ({ params }) => (
    <div className="dc-param-table">
      <table>
        <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          {params.map(([name, type, req, desc]) => (
            <tr key={name}>
              <td><code>{name}</code></td>
              <td className="dc-param-type">{type}</td>
              <td>{req ? <span className="dc-badge dc-badge--req">Required</span> : <span className="dc-badge">Optional</span>}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════════
     Render
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="dc-layout">
      {/* ── Sidebar ── */}
      <aside className="dc-sidebar">
        <div className="dc-sidebar__head">
          <BookOpen size={18} />
          <span>API Reference</span>
        </div>
        <div className="dc-sidebar__search">
          <Search size={16} />
          <input placeholder="Search docs…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <nav className="dc-nav">
          {Object.entries(filteredNav).map(([category, items]) => (
            <div key={category} className="dc-nav__group">
              <span className="dc-nav__cat">{category}</span>
              {items.map(item => (
                <button
                  key={item.id}
                  className={`dc-nav__item ${activeSection === item.id ? 'dc-nav__item--active' : ''}`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                  {activeSection === item.id && <ChevronRight size={12} className="dc-nav__chevron" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="dc-sidebar__footer">
          <span>Base URL</span>
          <code>{BASE}</code>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="dc-content">
        <article className="dc-article">

          {/* ─── INTRODUCTION ────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['introduction'] = el)} className="dc-section" id="introduction">
            <span className="dc-section__label">Getting Started</span>
            <h1>InferX API</h1>
            <p className="dc-lead">
              A unified, OpenAI-compatible API gateway to access 50+ LLMs from Google, Meta, Anthropic, OpenAI, Mistral, DeepSeek, xAI and more — with built-in agents, RAG, and tool use.
            </p>

            <div className="dc-feature-grid">
              {[
                ['OpenAI Compatible', 'Drop-in replacement — use any OpenAI SDK with one line changed.'],
                ['50+ Models', 'Gemini, Llama, Claude, GPT-4, Mistral, DeepSeek, Grok and more.'],
                ['Free Models', 'Access Gemini, Groq, Cerebras, SambaNova models at ₹0.'],
                ['Agents & Tools', 'Multi-step AI agents with web search, code execution, RAG.'],
                ['Knowledge Base', 'Upload documents and let agents search them semantically.'],
                ['MCP Protocol', 'Connect any MCP-compatible tool server to your agents.'],
              ].map(([title, desc]) => (
                <div key={title} className="dc-feature-card">
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              ))}
            </div>

            <Callout type="info">
              InferX is fully OpenAI-compatible. If your app works with the OpenAI API, it works with InferX — just change the <code>base_url</code> to <code>{BASE}/v1</code>.
            </Callout>
          </section>

          {/* ─── AUTHENTICATION ──────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['authentication'] = el)} className="dc-section" id="authentication">
            <span className="dc-section__label">Getting Started</span>
            <h2>Authentication</h2>
            <p>All API requests require an API key sent in the <code>Authorization</code> header. Generate keys from <strong>Settings → API Keys</strong> in the dashboard.</p>

            <CodeBlock code={`Authorization: Bearer ix-xxxxxxxxxxxxxxxxxxxxxxxx`} id="auth-header" lang="Header" />

            <Callout type="warning">
              Keep your API key secret. Never expose it in client-side code, public repositories, or browser requests. Use server-side calls or environment variables.
            </Callout>

            <h3>Key Format</h3>
            <div className="dc-param-table">
              <table>
                <thead><tr><th>Prefix</th><th>Environment</th><th>Description</th></tr></thead>
                <tbody>
                  <tr><td><code>ix-</code></td><td>Production</td><td>Live API key — all requests are billed</td></tr>
                  <tr><td><code>ix-test-</code></td><td>Testing</td><td>Test key — limited rate, no billing</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── QUICK START ─────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['quickstart'] = el)} className="dc-section" id="quickstart">
            <span className="dc-section__label">Getting Started</span>
            <h2>Quick Start</h2>
            <p>Get a response from an LLM in under a minute. Pick your language:</p>

            <h3>Python</h3>
            <p>Install the OpenAI SDK: <code>pip install openai</code></p>
            <CodeBlock code={snippets.pythonQuick} id="qs-python" lang="Python" />

            <h3>Node.js</h3>
            <p>Install the OpenAI SDK: <code>npm install openai</code></p>
            <CodeBlock code={snippets.nodeQuick} id="qs-node" lang="JavaScript" />

            <h3>cURL</h3>
            <CodeBlock code={snippets.curlQuick} id="qs-curl" lang="cURL" />
          </section>

          {/* ─── CHAT COMPLETIONS ────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['chat-completions'] = el)} className="dc-section" id="chat-completions">
            <span className="dc-section__label">Core API</span>
            <h2>Chat Completions</h2>
            <p>The primary endpoint for generating text. Fully compatible with the OpenAI Chat Completions API.</p>

            <Endpoint method="POST" path="/v1/chat/completions" />

            <h3>Request Body</h3>
            <ParamTable params={[
              ['model', 'string', true, 'Model ID (e.g. llama-3.3-70b, gemini-2.0-flash, claude-sonnet-4.5)'],
              ['messages', 'array', true, 'Conversation messages. Each has role (system, user, assistant) and content.'],
              ['temperature', 'float', false, 'Sampling temperature (0.0 – 2.0). Default: 1.0'],
              ['max_tokens', 'integer', false, 'Maximum tokens to generate. Default: model-specific.'],
              ['top_p', 'float', false, 'Nucleus sampling threshold (0.0 – 1.0). Default: 1.0'],
              ['stream', 'boolean', false, 'If true, returns Server-Sent Events. Default: false'],
              ['stop', 'string | array', false, 'Stop sequence(s) where generation halts.'],
            ]} />

            <h3>Example Request</h3>
            <CodeBlock code={snippets.chatRequest} id="chat-req" lang="HTTP" />

            <h3>Example Response</h3>
            <CodeBlock code={snippets.chatResponse} id="chat-res" lang="JSON" />
          </section>

          {/* ─── STREAMING ───────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['streaming'] = el)} className="dc-section" id="streaming">
            <span className="dc-section__label">Core API</span>
            <h2>Streaming</h2>
            <p>Set <code>"stream": true</code> to receive tokens as Server-Sent Events (SSE) in real time. Each chunk contains a <code>delta</code> object with partial content. The stream ends with <code>data: [DONE]</code>.</p>

            <CodeBlock code={snippets.streamCurl} id="stream-req" lang="cURL" />

            <h3>Stream Format</h3>
            <CodeBlock code={snippets.streamResponse} id="stream-res" lang="SSE" />

            <Callout type="tip">
              The OpenAI Python and Node.js SDKs handle streaming automatically — just iterate over the response.
            </Callout>
          </section>

          {/* ─── EMBEDDINGS ──────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['embeddings'] = el)} className="dc-section" id="embeddings">
            <span className="dc-section__label">Core API</span>
            <h2>Embeddings</h2>
            <p>Generate vector embeddings for semantic search, clustering, or building RAG pipelines.</p>

            <Endpoint method="POST" path="/v1/embeddings" />

            <ParamTable params={[
              ['model', 'string', true, 'Embedding model ID (e.g. bge-large-en-v1.5)'],
              ['input', 'string | array', true, 'Text or array of texts to embed'],
            ]} />

            <CodeBlock code={snippets.embeddingRequest} id="embed-req" lang="HTTP" />
            <CodeBlock code={snippets.embeddingResponse} id="embed-res" lang="JSON" />
          </section>

          {/* ─── MODELS ──────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['models'] = el)} className="dc-section" id="models">
            <span className="dc-section__label">Core API</span>
            <h2>Models</h2>
            <p>List all available models with pricing and capability information.</p>

            <Endpoint method="GET" path="/v1/models" />

            <h3>Available Providers</h3>
            <div className="dc-param-table">
              <table>
                <thead><tr><th>Provider</th><th>Example Models</th><th>Pricing</th></tr></thead>
                <tbody>
                  <tr><td>Google Gemini</td><td>gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash</td><td className="dc-text-success">Free</td></tr>
                  <tr><td>Groq</td><td>llama-3.3-70b, qwen3-32b, mistral-saba-24b</td><td className="dc-text-success">Free</td></tr>
                  <tr><td>SambaNova</td><td>qwen3-235b, deepseek-v3, llama-4-maverick</td><td className="dc-text-success">Free</td></tr>
                  <tr><td>Cerebras</td><td>llama-3.3-70b, qwen3-32b, deepseek-r1</td><td className="dc-text-success">Free</td></tr>
                  <tr><td>OpenRouter</td><td>deepseek-r1, glm-4.5-air, nemotron-30b</td><td className="dc-text-success">Free</td></tr>
                  <tr><td>Anthropic</td><td>claude-sonnet-4.5, claude-haiku-4.5, claude-opus-4</td><td>Paid (INR)</td></tr>
                  <tr><td>OpenAI</td><td>gpt-4o, gpt-4.1, o3, o4-mini</td><td>Paid (INR)</td></tr>
                  <tr><td>Mistral</td><td>mistral-large-3, codestral, magistral-medium</td><td>Paid (INR)</td></tr>
                  <tr><td>DeepSeek</td><td>deepseek-chat, deepseek-reasoner</td><td>Paid (INR)</td></tr>
                  <tr><td>xAI</td><td>grok-4, grok-4-mini</td><td>Paid (INR)</td></tr>
                </tbody>
              </table>
            </div>

            <Callout type="tip">
              Free models have zero cost — use them without adding credits. Paid models require a minimum balance of ₹100. Check the <strong>Models</strong> page in the dashboard for exact per-token pricing.
            </Callout>
          </section>

          {/* ─── AGENTS ──────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['agents'] = el)} className="dc-section" id="agents">
            <span className="dc-section__label">Platform</span>
            <h2>Agents</h2>
            <p>Agents are multi-step AI workflows. You give an agent instructions, a model, and a set of tools. When invoked, the agent autonomously reasons, calls tools, and returns a final answer with a full execution trace.</p>

            <h3>How It Works</h3>
            <ol className="dc-steps">
              <li>Your message is sent to the LLM along with available tools.</li>
              <li>The LLM decides whether a tool is needed. If yes, it emits a <code>tool_call</code>.</li>
              <li>InferX executes the tool server-side and feeds the result back to the LLM.</li>
              <li>Steps 2–3 repeat until the LLM produces a final answer or <code>max_steps</code> is reached.</li>
            </ol>

            <h3>Create an Agent</h3>
            <Endpoint method="POST" path="/v1/agents" />
            <ParamTable params={[
              ['name', 'string', true, 'Display name'],
              ['instructions', 'string', true, 'System prompt / persona'],
              ['model', 'string', true, 'Any InferX model ID'],
              ['tools', 'string[]', false, 'Built-in tools to enable (see table below)'],
              ['kb_id', 'string', false, 'Knowledge base ID to attach for RAG'],
              ['mcp_server_ids', 'string[]', false, 'MCP server IDs for external tools'],
              ['max_steps', 'integer', false, 'Max reasoning steps. Default: 10'],
              ['temperature', 'float', false, 'LLM temperature (0.0 – 1.0)'],
            ]} />
            <CodeBlock code={snippets.createAgent} id="create-agent" lang="HTTP" />

            <h3>Invoke an Agent</h3>
            <Endpoint method="POST" path="/v1/agents/{agent_id}/invoke" />
            <ParamTable params={[
              ['message', 'string', true, 'User message to send'],
              ['session_id', 'string', false, 'Pass the same ID for multi-turn memory'],
            ]} />
            <CodeBlock code={snippets.invokeAgent} id="invoke-agent" lang="HTTP" />
            <CodeBlock code={snippets.agentResponse} id="agent-res" lang="JSON" />

            <h3>Built-in Tools</h3>
            <div className="dc-param-table">
              <table>
                <thead><tr><th>Tool</th><th>Description</th></tr></thead>
                <tbody>
                  <tr><td><code>web_search</code></td><td>Live web search via DuckDuckGo</td></tr>
                  <tr><td><code>web_scrape</code></td><td>Fetch and extract text from any URL</td></tr>
                  <tr><td><code>calculator</code></td><td>Safe math expression evaluator</td></tr>
                  <tr><td><code>code_execution</code></td><td>Run Python code in a secure sandbox</td></tr>
                  <tr><td><code>knowledge_base_search</code></td><td>Semantic search over your uploaded documents</td></tr>
                  <tr><td><code>get_current_time</code></td><td>Returns current UTC date and time</td></tr>
                </tbody>
              </table>
            </div>

            <Callout type="info">
              Agent invocations carry a <strong>45% markup</strong> on top of the model's token price due to multi-step overhead. Free models remain free.
            </Callout>
          </section>

          {/* ─── KNOWLEDGE BASE ──────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['knowledge-base'] = el)} className="dc-section" id="knowledge-base">
            <span className="dc-section__label">Platform</span>
            <h2>Knowledge Base</h2>
            <p>Upload documents (PDF, TXT, DOCX, Markdown) and InferX will chunk, embed, and store them in a vector database. Query them directly or attach them to agents for RAG.</p>

            <h3>Workflow</h3>
            <ol className="dc-steps">
              <li>Create a knowledge base.</li>
              <li>Upload documents — InferX chunks and embeds them automatically.</li>
              <li>Query directly via API, or attach <code>kb_id</code> to an agent.</li>
            </ol>

            <CodeBlock code={snippets.kbCreate} id="kb-create" lang="HTTP" />

            <Callout type="tip">
              When attached to an agent, the <code>knowledge_base_search</code> tool is automatically available. The agent will search your docs when relevant to the user's question.
            </Callout>
          </section>

          {/* ─── MCP ─────────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['mcp'] = el)} className="dc-section" id="mcp">
            <span className="dc-section__label">Platform</span>
            <h2>MCP Servers</h2>
            <p>Connect any <strong>Model Context Protocol</strong> (MCP) server to give agents access to external tools — your CRM, database, internal APIs, or third-party services like GitHub and Slack.</p>

            <h3>Setup</h3>
            <ol className="dc-steps">
              <li>Register your MCP server URL.</li>
              <li>Connect — InferX performs a JSON-RPC handshake and discovers tools.</li>
              <li>Attach the server to an agent via <code>mcp_server_ids</code>.</li>
            </ol>

            <CodeBlock code={snippets.mcpSetup} id="mcp-setup" lang="HTTP" />

            <Callout type="info">
              Supported transports: <code>streamable_http</code> (recommended) and <code>sse</code>. MCP tools appear in the agent as <code>mcp_servername_toolname</code>.
            </Callout>
          </section>

          {/* ─── BATCH ───────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['batch'] = el)} className="dc-section" id="batch">
            <span className="dc-section__label">Platform</span>
            <h2>Batch API</h2>
            <p>Submit hundreds of completion requests in a single job. Ideal for data pipelines, bulk classification, or offline analysis. Jobs run asynchronously.</p>

            <Endpoint method="POST" path="/v1/batch/jobs" />

            <CodeBlock code={snippets.batchRequest} id="batch-req" lang="HTTP" />
          </section>

          {/* ─── RATE LIMITS ─────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['rate-limits'] = el)} className="dc-section" id="rate-limits">
            <span className="dc-section__label">Reference</span>
            <h2>Rate Limits</h2>
            <p>Rate limits are applied per API key. Exceeding them returns <code>HTTP 429</code> with a <code>Retry-After</code> header.</p>

            <div className="dc-param-table">
              <table>
                <thead><tr><th>Tier</th><th>Requests / min</th><th>Tokens / min</th></tr></thead>
                <tbody>
                  <tr><td>Free</td><td>30</td><td>50,000</td></tr>
                  <tr><td>Standard</td><td>120</td><td>200,000</td></tr>
                </tbody>
              </table>
            </div>

            <Callout type="info">
              Free provider models (Groq, SambaNova, etc.) may have additional provider-imposed limits. If you receive a 429 from the upstream provider, InferX will pass it through with a retry hint.
            </Callout>
          </section>

          {/* ─── ERRORS ──────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['errors'] = el)} className="dc-section" id="errors">
            <span className="dc-section__label">Reference</span>
            <h2>Error Codes</h2>
            <p>All errors follow a consistent JSON format:</p>

            <CodeBlock code={`{
  "error": "Insufficient credits",
  "status_code": 402,
  "request_id": "req_abc123..."
}`} id="error-format" lang="JSON" />

            <div className="dc-param-table">
              <table>
                <thead><tr><th>Status</th><th>Meaning</th><th>What to Do</th></tr></thead>
                <tbody>
                  <tr><td><code>400</code></td><td>Bad Request</td><td>Check request body and parameters</td></tr>
                  <tr><td><code>401</code></td><td>Unauthorized</td><td>Check your API key</td></tr>
                  <tr><td><code>402</code></td><td>Insufficient Credits</td><td>Add credits in Billing page</td></tr>
                  <tr><td><code>404</code></td><td>Not Found</td><td>Check endpoint path and resource IDs</td></tr>
                  <tr><td><code>429</code></td><td>Rate Limited</td><td>Wait and retry after Retry-After seconds</td></tr>
                  <tr><td><code>500</code></td><td>Server Error</td><td>Retry the request. Contact support if persistent.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── SDKs ────────────────────────────────────────────────── */}
          <section ref={el => (sectionRefs.current['sdks'] = el)} className="dc-section" id="sdks">
            <span className="dc-section__label">Reference</span>
            <h2>SDKs & Libraries</h2>
            <p>InferX works with any OpenAI-compatible SDK. Just change the base URL.</p>

            <h3>Python</h3>
            <CodeBlock code={`pip install openai

from openai import OpenAI
client = OpenAI(api_key="ix-xxxxxxxxxxxxxxxxxxxxxxxx", base_url="${BASE}/v1")`} id="sdk-python" lang="Python" />

            <h3>Node.js / TypeScript</h3>
            <CodeBlock code={`npm install openai

import OpenAI from 'openai';
const client = new OpenAI({ apiKey: 'ix-xxxxxxxxxxxxxxxxxxxxxxxx', baseURL: '${BASE}/v1' });`} id="sdk-node" lang="JavaScript" />

            <h3>cURL</h3>
            <CodeBlock code={`# Set your API key
export INFERX_API_KEY="ix-xxxxxxxxxxxxxxxxxxxxxxxx"

# Make a request
curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer $INFERX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"Hello"}]}'`} id="sdk-curl" lang="Bash" />

            <Callout type="tip">
              Any library that supports a custom <code>base_url</code> / <code>baseURL</code> will work — LangChain, LlamaIndex, Vercel AI SDK, etc.
            </Callout>
          </section>

        </article>
      </main>
    </div>
  )
}

export default Documentation
