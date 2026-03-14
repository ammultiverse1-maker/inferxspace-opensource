<h1 align="center">
  <img src="https://inferx.space/assets/logo-white-DDzi8NVg.svg" alt="InferXSpace Logo" width="80" />
  <br/>InferXSpace
</h1>

<p align="center">
  <strong>Open-source, self-hosted AI gateway.</strong><br/>
  Bring Your Own Keys. OpenAI-compatible API. One-command deploy.
</p>

<p align="center">
  <a href="#-quickstart"><strong>Quickstart →</strong></a> ·
  <a href="#-features">Features</a> ·
  <a href="docs/">Docs</a> ·
  <a href="LICENSE">MIT License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" />
  <img src="https://img.shields.io/badge/OpenAI--compatible-yes-orange" />
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" />
</p>

---

## What is InferXSpace?

InferXSpace is a **self-hosted AI gateway** that gives you a single OpenAI-compatible endpoint to route requests to any LLM provider — OpenAI, Anthropic, Google Gemini, Groq, Mistral, Together AI, or your own custom vLLM/Ollama instance.

You bring your own API keys (`BYOK`). InferXSpace handles:

- ✅ **OpenAI-compatible `/v1/chat/completions`** — drop-in replacement
- ✅ **User management** — email/password + Google/GitHub OAuth
- ✅ **API keys** — generate and manage per-user API keys
- ✅ **Usage tracking** — per-model token and cost logging
- ✅ **Credit system** — token balance with pluggable payment integration
- ✅ **RAG / Knowledge Bases** — upload PDFs, docs, and query them
- ✅ **MCP support** — Model Context Protocol for tool use
- ✅ **Beautiful dashboard** — React frontend included
- ✅ **One-command Docker deploy**

---

## ✨ Features

| Category | Details |
|----------|---------|
| **Inference** | OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, Together AI, Custom (vLLM / Ollama) |
| **Auth** | Email + password, Google OAuth, GitHub OAuth |
| **API Keys** | Per-user key generation, rotation, revocation |
| **Usage** | Token counting, cost estimation per model, per-user logs |
| **Credits** | Token-based credit system, pluggable payment backend |
| **RAG** | ChromaDB vector store, PDF/DOCX/TXT ingestion, semantic search |
| **Dashboard** | React 18 + Tailwind CSS frontend |
| **Database** | SQLite (zero-config) or PostgreSQL |
| **Cache** | Redis (optional, gracefully degraded) |

---

## 🚀 Quickstart

### 1. Clone and configure

```bash
git clone https://github.com/ammultiverse1-maker/inferxspace-opensource.git
cd inferxspace-opensource
cp .env.example .env
# Edit .env and add your provider API keys
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

- **Frontend** → http://localhost:5173  
- **API** → http://localhost:8000  
- **API Docs** → http://localhost:8000/docs

### 3. Test the API

```bash
# Register a user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","full_name":"Your Name"}'

# Get an InferXSpace API key from the dashboard, then:
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer ix-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Required

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing secret — run `openssl rand -hex 32` |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/inferxspace.db` (default) |

### Provider Keys (add at least one)

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI (GPT-4o, etc.) |
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `GOOGLE_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq (ultra-fast inference) |
| `MISTRAL_API_KEY` | Mistral AI |
| `TOGETHER_API_KEY` | Together AI |
| `CUSTOM_API_BASE` | Custom endpoint (vLLM, Ollama, LM Studio) |

### OAuth (optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret |

→ See [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) for setup instructions.

---

## 🏗️ Architecture

```
inferxspace/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── api/routes/       # Auth, users, completions, credits, RAG...
│   │   ├── core/             # Config, database, security, OAuth
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── providers/        # BYOK provider routing (byok.py)
│   │   └── schemas/          # Pydantic schemas
│   ├── alembic/              # Database migrations
│   └── Dockerfile
├── frontend/         # React 18 + Vite + Tailwind CSS
│   └── src/
│       ├── pages/            # Dashboard, Playground, Usage, Settings...
│       ├── components/       # Shared UI components
│       └── api/              # API client (axios)
├── docs/             # Documentation
├── docker-compose.yml
└── .env.example
```

The key file is `backend/app/providers/byok.py` — it maps model names to your configured provider keys and proxies requests using the OpenAI-compatible format.

---

## 💳 Adding Payments

The credit purchase flow is a placeholder by design. To add payments:

1. Pick a provider: **Stripe**, LemonSqueezy, Paddle, etc.
2. See [docs/PAYMENTS.md](docs/PAYMENTS.md) for step-by-step guide
3. Implement `POST /api/credits/purchase` and `POST /api/credits/verify` in `backend/app/api/routes/credits.py`

For development, use `POST /api/credits/admin/grant` to add tokens:

```bash
curl -X POST http://localhost:8000/api/credits/admin/grant \
  -H "Authorization: Bearer ix-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"tokens": 10000000, "note": "dev top-up"}'
```

---

## 🛠️ Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # and fill in keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev   # starts on http://localhost:5173
```

---

## 🐳 Docker

```bash
# Build and run everything
docker compose up --build

# Backend only
cd backend && docker build -t inferxspace-backend . && docker run -p 8000:8000 --env-file ../.env inferxspace-backend
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo and create a feature branch
2. Make your changes with clear commits
3. Add tests if relevant
4. Open a pull request with a description

---

## 📄 License

[MIT License](LICENSE) — free to use, modify, and distribute.

---

<p align="center">Built with ❤️ | Star ⭐ if you find it useful!</p>
