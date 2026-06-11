# Compass — Technical Specifications

| Field | Value |
|---|---|
| Product | Compass v1.0 |
| Document Type | Technical Specifications |
| Status | Draft |
| Author | Parthi Gadher |
| Last Updated | June 2026 |
| References | Compass PRD v1.0, Build Guide v1.0 |

---

## Table of Contents

1. System Architecture
2. Technology Stack
3. Component Specifications
4. API Contract
5. WebSocket Protocol
6. Database Schema
7. ML Model Specification
8. ChromaDB Configuration
9. Redis Cache Strategy
10. Error Handling
11. Performance Specifications
12. Security Implementation
13. Deployment Architecture
14. Testing Strategy
15. Monitoring

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + TypeScript)                   │
│  ManifestUpload  │  PackageGrid  │  ShapChart  │  StreamingReport   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ WebSocket wss://
                             │ REST https://
┌────────────────────────────▼────────────────────────────────────────┐
│                     FASTAPI BACKEND (Railway)                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    AGENT PIPELINE                            │    │
│  │                                                              │    │
│  │  Signal Collector ──► Risk Classifier ──► Incident Retriever │    │
│  │       │                    │                    │            │    │
│  │   GitHub API           XGBoost               ChromaDB       │    │
│  │   (async)              + SHAP               (RAG corpus)    │    │
│  │       │                    │                                 │    │
│  │       └──────────────────► Report Generator                 │    │
│  │                              (LangChain + Gemini)            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  PostgreSQL │  │    Redis     │  │     ChromaDB               │  │
│  │  (history)  │  │   (cache)    │  │  (postmortem embeddings)   │  │
│  └────────────┘  └──────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   GitHub API    │
                    │   PyPI API      │
                    │   npm Registry  │
                    │   Gemini API    │
                    └─────────────────┘
```

### 1.2 Request Flow for a Full Analysis

```
1. Client uploads manifest → POST /analyze/parse (validate + extract packages)
2. Client opens WebSocket → WS /ws/analyze
3. Client sends {content, filename} over WebSocket
4. Backend spawns async analysis pipeline:
   For each package (concurrency limit: 5 simultaneous):
   a. Signal Collector: resolve repo → fetch 8 GitHub endpoints → compute 18 features
   b. Risk Classifier: XGBoost predict → SHAP → build result dict
   c. Incident Retriever: if risk_score ≥ 50 → ChromaDB query → return 3 incidents
   d. Send `package_result` message over WebSocket → frontend card populates
5. After all packages complete:
   a. Aggregate high-risk and at-risk packages
   b. Call Report Generator: LangChain chain → Gemini streaming
   c. Send `report_token` messages → frontend report streams
6. Send `complete` message with summary statistics
7. Persist analysis to PostgreSQL (background task)
```

---

## 2. Technology Stack

### 2.1 Backend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| API Framework | FastAPI | 0.111.0 | REST + WebSocket server |
| Runtime | Python | 3.11 | Language runtime |
| ASGI Server | Uvicorn | 0.29.0 | Production server |
| HTTP Client | httpx | 0.27.0 | Async GitHub/PyPI/npm API calls |
| ML Framework | XGBoost | 2.0.3 | Risk classification model |
| ML Utilities | scikit-learn | 1.4.2 | Data splitting, metrics |
| Explainability | SHAP | 0.45.0 | Feature attribution |
| Sentiment | vaderSentiment | 3.3.2 | Commit message sentiment |
| Orchestration | LangChain | 0.2.5 | Agent pipeline + streaming |
| LLM | Gemini 1.5 Flash | via LangChain | Report generation |
| Embeddings | sentence-transformers | 3.0.1 | Postmortem embedding |
| Vector DB | ChromaDB | 0.5.0 | Incident postmortem RAG |
| Database | PostgreSQL | 16 | Analysis history |
| ORM | SQLAlchemy (async) | 2.0.30 | DB interaction layer |
| DB Driver | asyncpg | 0.29.0 | Async PostgreSQL driver |
| Cache | Redis | 7 (server) | GitHub API response cache |
| Redis Client | redis[asyncio] | 5.0.6 | Async Redis client |
| Data | pandas | 2.2.2 | Feature dataframes |
| Numerics | numpy | 1.26.4 | Feature computation |
| Serialization | pydantic | 2.7.4 | Request/response validation |
| Text Extraction | trafilatura | 1.9.0 | Postmortem corpus building |
| Model Persistence | joblib | 1.4.2 | Save/load XGBoost model |

### 2.2 Frontend

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.x | UI framework |
| Language | TypeScript | 5.x | Type safety |
| Build Tool | Vite | 5.x | Development + bundling |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Charts | Recharts | 2.x | SHAP bar charts, risk gauges |
| HTTP | Axios | 1.x | REST calls |
| WebSocket | Native browser WebSocket API | — | Streaming connection |

### 2.3 Infrastructure

| Component | Service | Plan |
|---|---|---|
| Backend hosting | Railway | Free ($5/month credit) |
| Frontend hosting | Vercel | Free tier |
| Database | Railway PostgreSQL plugin | Free (1GB) |
| Redis | Railway Redis plugin | Free (25MB) |
| ChromaDB | Local persistent volume on Railway | — |
| Domain | Railway-provided subdomain | — |

---

## 3. Component Specifications

### 3.1 Signal Collector Agent

**File:** `backend/agents/signal_collector.py`

**Responsibility:** Resolve a package name to a GitHub repository, call 8 GitHub API endpoints concurrently, compute 18 behavioral features.

**Interface:**

```python
async def collect_signals(owner: str, repo: str) -> dict[str, float]:
    """
    Collect 18 behavioral signals for a GitHub repository.
    Returns a flat dict mapping feature names to float values.
    All 18 features guaranteed to be present; defaults applied on error.
    """
```

```python
async def resolve_package(name: str, ecosystem: str) -> tuple[str, str] | None:
    """
    Resolve a package name to GitHub (owner, repo).
    Returns None if no GitHub repository is found.
    ecosystem: "pypi" | "npm"
    """
```

**Concurrency:** Up to 5 packages analyzed simultaneously (controlled by `asyncio.Semaphore(5)` in the WebSocket handler).

**Error handling:** Any exception within `collect_signals` for a single package is caught and returns a dict of default feature values (all zeros) plus an `error` key with the exception message.

---

### 3.2 Risk Classifier Agent

**File:** `backend/agents/risk_classifier.py`

**Responsibility:** Accept a feature dict, run XGBoost prediction, compute SHAP attributions, return structured result.

**Interface:**

```python
def classify_package(signals: dict[str, float]) -> dict:
    """
    Run XGBoost classification and SHAP explanation.
    Returns structured result dict (see response schema in Section 4).
    Raises RuntimeError if model files are not loaded.
    """
```

**Model loading:** Models are loaded once at module import time using `joblib.load()`. Import will fail at startup if model files are missing — this is intentional (fail fast).

**SHAP computation:** Uses `shap.TreeExplainer` (pre-loaded). TreeSHAP runs in O(TLD) where T=trees, L=leaves, D=depth — effectively instantaneous on our model size.

---

### 3.3 Incident Retriever Agent

**File:** `backend/agents/incident_retriever.py`

**Responsibility:** Query ChromaDB with a semantic query derived from the package name and top risk signals.

**Interface:**

```python
def retrieve_incidents(
    package_name: str,
    risk_signals: list[str],
    n_results: int = 3
) -> list[dict]:
    """
    Query incident postmortem corpus for relevant historical incidents.
    Returns up to n_results incidents above similarity threshold 0.30.
    Returns empty list if ChromaDB unavailable or no results above threshold.
    """
```

**Query construction:** `f"{package_name} {' '.join(risk_signals[:2])} production incident outage"`

**Only triggered when:** `risk_score >= 50`

---

### 3.4 Report Generator Agent

**File:** `backend/agents/report_generator.py`

**Responsibility:** Accept aggregated analysis results and stream a natural language report via LangChain + Gemini.

**Interface:**

```python
async def generate_report_stream(
    manifest_name: str,
    package_count: int,
    high_risk: list[tuple[str, dict]],
    at_risk: list[tuple[str, dict]]
) -> AsyncIterator[str]:
    """
    Async generator yielding LLM report tokens.
    Caller is responsible for sending tokens over WebSocket.
    """
```

**Chain:** `ChatPromptTemplate | ChatGoogleGenerativeAI(streaming=True) | StrOutputParser()`

**Fallback:** If Gemini fails, `generate_report_stream` raises `GeminiFallbackException`. Caller catches this and calls `generate_report_structured(...)` which returns a static markdown string built from structured data.

---

### 3.5 GitHub Client

**File:** `backend/core/github_client.py`

**Responsibility:** Async GitHub API wrapper with Redis caching and retry logic.

**Interface:**

```python
async def github_get(
    client: httpx.AsyncClient,
    path: str,
    params: dict | None = None
) -> dict | list:
    """
    Make a cached, retried GET request to the GitHub API.
    - Checks Redis cache before making API call
    - Retries up to 3 times on 202 (stats computing)
    - Returns {} on 404
    - Raises GitHubRateLimitError on 403
    - Caches successful responses for 21,600 seconds
    """
```

**Auth:** `Authorization: token {GITHUB_TOKEN}` header on all requests.

**Rate limit handling:** If a 403 is received, raise `GitHubRateLimitError`. The caller (Signal Collector) catches this and marks the package as unanalyzable.

---

## 4. API Contract

### Base URL
- Development: `http://localhost:8000`
- Production: `https://compass-api.up.railway.app`

### Authentication
No authentication required for v1.0 (public API).

---

### 4.1 `POST /analyze/parse`

**Purpose:** Validate and parse an uploaded manifest file. Returns the list of extracted package names before analysis begins. Client uses this to display "Found N packages" before opening the WebSocket.

**Request:**
```
Content-Type: multipart/form-data
Body: file (binary)
```

**Response 200:**
```json
{
  "filename": "requirements.txt",
  "ecosystem": "pypi",
  "packages": ["fastapi", "httpx", "langchain", "chromadb"],
  "package_count": 4,
  "capped": false,
  "cap_limit": 25
}
```

If `package_count > 25`: `capped: true`, `packages` contains only the first 25.

**Response 400:**
```json
{
  "detail": "Unsupported file type. Upload requirements.txt or package.json."
}
```

**Response 422:**
```json
{
  "detail": "File is empty or could not be parsed."
}
```

---

### 4.2 `GET /history`

**Purpose:** Return the last 10 completed analyses with per-package summaries.

**Request:** No body. No parameters.

**Response 200:**
```json
{
  "analyses": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "manifest_name": "requirements.txt",
      "package_count": 20,
      "healthy_count": 16,
      "at_risk_count": 3,
      "dying_count": 1,
      "created_at": "2026-06-01T14:32:00Z",
      "packages": [
        {
          "package_name": "event-stream",
          "risk_class": "Dying",
          "risk_score": 84,
          "github_repo": "dominictarr/event-stream"
        }
      ]
    }
  ]
}
```

---

### 4.3 `GET /package/{package_name}`

**Purpose:** Analyze a single package by name. Synchronous (waits for completion). For single-package lookups in a browser or CI context.

**Request:** Path parameter `package_name` (URL-encoded if necessary).

**Query parameters:**
- `ecosystem`: `"pypi"` (default) or `"npm"`

**Response 200:**
```json
{
  "package_name": "requests",
  "github_repo": "psf/requests",
  "risk_score": 12,
  "risk_class": "Healthy",
  "risk_color": "green",
  "confidence": 94.2,
  "probabilities": {
    "healthy": 94.2,
    "at_risk": 4.8,
    "dying": 1.0
  },
  "top_signals": [
    {
      "feature": "commit_freq_mean_52w",
      "value": 3.8,
      "shap_value": -0.412,
      "importance": 0.412,
      "direction": "decreases",
      "human_readable": "Averaging 3.8 commits per week — healthy activity level"
    }
  ],
  "shap_chart_data": [
    {"feature": "commit_freq_mean_52w", "shap": -0.412, "value": 3.8},
    {"feature": "top_contributor_pct", "shap": 0.183, "value": 41.2}
  ],
  "incidents": []
}
```

**Response 404:**
```json
{
  "detail": "Package 'nonexistent-package' not found on PyPI or has no GitHub source."
}
```

**Response 503:**
```json
{
  "detail": "GitHub API is currently unavailable. Try again in a few minutes."
}
```

---

### 4.4 `GET /health`

**Purpose:** Health check endpoint for Railway uptime monitoring.

**Response 200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "model_loaded": true,
  "chromadb_connected": true,
  "redis_connected": true,
  "postgres_connected": true
}
```

**Response 503:** If any critical component is unavailable (`model_loaded: false` or `postgres_connected: false`). Non-critical components (`chromadb_connected: false`, `redis_connected: false`) do not trigger 503.

---

## 5. WebSocket Protocol

### 5.1 Connection

**URL:** `wss://{host}/ws/analyze`

Client establishes connection, then sends exactly one JSON message to start analysis. Server sends multiple messages and closes the connection after the `complete` or `error` message.

---

### 5.2 Client → Server (single message)

```json
{
  "content": "fastapi>=0.100.0\nhttpx==0.27.0\nlangchain==0.2.5",
  "filename": "requirements.txt"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| content | string | yes | Raw text content of the manifest file |
| filename | string | yes | Filename, used to determine ecosystem (`.txt` = pypi, `.json` = npm) |

---

### 5.3 Server → Client Message Types

#### `start`
Sent immediately after parsing the manifest.
```json
{
  "type": "start",
  "total": 20,
  "packages": ["fastapi", "httpx", "langchain"]
}
```

#### `progress`
Sent when analysis of each package begins.
```json
{
  "type": "progress",
  "package": "httpx",
  "current": 3,
  "total": 20
}
```

#### `package_result`
Sent when one package's full analysis completes. This is the primary data message.
```json
{
  "type": "package_result",
  "package": "event-stream",
  "result": {
    "risk_score": 84,
    "risk_class": "Dying",
    "risk_color": "red",
    "confidence": 88.4,
    "probabilities": {
      "healthy": 3.2,
      "at_risk": 8.4,
      "dying": 88.4
    },
    "top_signals": [
      {
        "feature": "top_contributor_pct",
        "value": 97.2,
        "shap_value": 0.621,
        "importance": 0.621,
        "direction": "increases",
        "human_readable": "Single contributor makes 97% of all commits (key-person risk)"
      },
      {
        "feature": "commit_freq_trend_slope",
        "value": -0.82,
        "shap_value": 0.441,
        "importance": 0.441,
        "direction": "increases",
        "human_readable": "Commit frequency is declining (-0.82 per week trend)"
      },
      {
        "feature": "commit_msg_sentiment_trend",
        "value": -0.34,
        "shap_value": 0.318,
        "importance": 0.318,
        "direction": "increases",
        "human_readable": "Maintainer sentiment is worsening over time"
      }
    ],
    "shap_chart_data": [
      {"feature": "top_contributor_pct", "shap": 0.621, "value": 97.2},
      {"feature": "commit_freq_trend_slope", "shap": 0.441, "value": -0.82}
    ],
    "incidents": [
      {
        "excerpt": "The root cause was a malicious version of event-stream published by a new maintainer...",
        "source_url": "https://blog.npmjs.org/post/180565383195",
        "similarity": 0.74
      }
    ],
    "github": "dominictarr/event-stream",
    "error": null
  }
}
```

If the package analysis failed:
```json
{
  "type": "package_result",
  "package": "some-package",
  "result": {
    "risk_score": null,
    "risk_class": "Unknown",
    "error": "No GitHub repository found for this package."
  }
}
```

#### `generating_report`
Sent when all packages are done and report generation begins.
```json
{
  "type": "generating_report",
  "message": "Generating dependency health report..."
}
```

#### `report_token`
Sent once per LLM token. Client appends to the report display area.
```json
{
  "type": "report_token",
  "token": " abandonment"
}
```

#### `complete`
Sent after the report finishes streaming.
```json
{
  "type": "complete",
  "summary": {
    "total_analyzed": 20,
    "healthy": 16,
    "at_risk": 3,
    "dying": 1,
    "skipped": 0,
    "analysis_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### `error`
Sent on unrecoverable failure. Connection closes after this message.
```json
{
  "type": "error",
  "message": "GitHub API rate limit exceeded. Please try again in 45 minutes.",
  "code": "GITHUB_RATE_LIMITED"
}
```

---

### 5.4 Error Codes

| Code | Meaning | Recovery |
|---|---|---|
| `GITHUB_RATE_LIMITED` | 403 from GitHub API | Wait and retry; check Redis cache configuration |
| `MANIFEST_PARSE_ERROR` | File content could not be parsed | Verify file format |
| `NO_PACKAGES_FOUND` | Manifest is empty | Upload a non-empty manifest |
| `GEMINI_UNAVAILABLE` | Gemini API call failed | Report falls back to structured text |
| `MODEL_NOT_LOADED` | XGBoost model file missing | Restart service after running model training |
| `UNKNOWN_ERROR` | Unexpected exception | Check server logs |

---

## 6. Database Schema

### 6.1 `analyses` table

```sql
CREATE TABLE analyses (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_name VARCHAR(255) NOT NULL,
    ecosystem   VARCHAR(10) NOT NULL CHECK (ecosystem IN ('pypi', 'npm')),
    package_count INTEGER    NOT NULL,
    healthy_count INTEGER    NOT NULL DEFAULT 0,
    at_risk_count INTEGER    NOT NULL DEFAULT 0,
    dying_count INTEGER      NOT NULL DEFAULT 0,
    skipped_count INTEGER    NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);
```

### 6.2 `package_results` table

```sql
CREATE TABLE package_results (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    package_name    VARCHAR(255) NOT NULL,
    github_repo     VARCHAR(255),
    ecosystem       VARCHAR(10) NOT NULL CHECK (ecosystem IN ('pypi', 'npm')),
    risk_score      INTEGER     CHECK (risk_score BETWEEN 0 AND 100),
    risk_class      VARCHAR(20) CHECK (risk_class IN ('Healthy', 'At Risk', 'Dying', 'Unknown')),
    confidence      NUMERIC(5,2),
    prob_healthy    NUMERIC(5,2),
    prob_at_risk    NUMERIC(5,2),
    prob_dying      NUMERIC(5,2),
    top_signals     JSONB,
    shap_chart_data JSONB,
    incidents       JSONB,
    raw_features    JSONB,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_package_results_analysis_id ON package_results(analysis_id);
CREATE INDEX idx_package_results_package_name ON package_results(package_name);
CREATE INDEX idx_package_results_risk_class ON package_results(risk_class);
```

### 6.3 SQLAlchemy Models

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Numeric, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime

class Base(DeclarativeBase):
    pass

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manifest_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ecosystem: Mapped[str] = mapped_column(String(10), nullable=False)
    package_count: Mapped[int] = mapped_column(Integer, nullable=False)
    healthy_count: Mapped[int] = mapped_column(Integer, default=0)
    at_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    dying_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class PackageResult(Base):
    __tablename__ = "package_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
    github_repo: Mapped[str | None] = mapped_column(String(255))
    ecosystem: Mapped[str] = mapped_column(String(10), nullable=False)
    risk_score: Mapped[int | None] = mapped_column(Integer)
    risk_class: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2))
    top_signals: Mapped[dict | None] = mapped_column(JSONB)
    shap_chart_data: Mapped[list | None] = mapped_column(JSONB)
    incidents: Mapped[list | None] = mapped_column(JSONB)
    raw_features: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
```

---

## 7. ML Model Specification

### 7.1 Problem Formulation

**Task:** Multi-class classification
**Classes:** 0 = Healthy, 1 = At Risk, 2 = Dying
**Input:** 18 float features derived from GitHub API data
**Output:** Class prediction + probability distribution + SHAP attributions

### 7.2 Training Data Specification

**Collection method:** GitHub Search API querying diverse repositories across Python and JavaScript ecosystems. Stratified by stars (low: <100, medium: 100-1000, high: >1000) and language.

**Labeling strategy:**

```python
def label_repo(repo_metadata: dict, signals: dict) -> int:
    # Class 2: Dying — official or behavioral abandonment
    if repo_metadata.get("archived"):
        return 2
    if signals["commit_freq_mean_52w"] < 0.05 and signals["zero_commit_weeks_ratio"] > 0.92:
        return 2

    # Class 1: At Risk — declining signals
    if (signals["commit_freq_trend_slope"] < -0.4 and
        signals["top_contributor_pct"] > 88):
        return 1
    if signals["zero_commit_weeks_ratio"] > 0.55:
        return 1
    if signals["days_since_last_release"] > 365:
        return 1

    # Class 0: Healthy
    return 0
```

**Target dataset size:** 8,000-10,000 labeled repositories
**Expected class distribution:** ~60% Healthy, ~25% At Risk, ~15% Dying (naturally imbalanced)

### 7.3 Feature Specification

| # | Feature Name | Type | Typical Range | Source Endpoint | Description |
|---|---|---|---|---|---|
| 1 | `commit_freq_mean_52w` | float | 0–50 | `/stats/commit_activity` | Mean commits per week over last 52 weeks |
| 2 | `commit_freq_trend_slope` | float | -5 to +5 | `/stats/commit_activity` | Linear regression slope on weekly commit counts |
| 3 | `commit_gap_max_days` | float | 0–365 | `/commits` | Maximum gap in days between any two consecutive commits |
| 4 | `zero_commit_weeks_ratio` | float | 0–1.0 | `/stats/commit_activity` | Fraction of weeks in past year with zero commits |
| 5 | `commit_msg_sentiment_mean` | float | -1 to +1 | `/commits` | Mean VADER compound sentiment of last 100 commit messages |
| 6 | `commit_msg_sentiment_trend` | float | -2 to +2 | `/commits` | Sentiment mean (recent 25) minus sentiment mean (older 25) |
| 7 | `commit_frustration_ratio` | float | 0–1.0 | `/commits` | Fraction of messages containing frustration keyword patterns |
| 8 | `top_contributor_pct` | float | 0–100 | `/contributors` | Percentage of total commits by single top contributor |
| 9 | `active_contributors_90d` | float | 0–50 | `/commits` | Count of unique contributors with commit in last 90 days |
| 10 | `open_closed_ratio` | float | 0–5.0 | `/issues` (open + closed) | Open issues / total issues |
| 11 | `unresponded_issue_ratio` | float | 0–1.0 | `/issues` | Issues with zero maintainer responses / total issues |
| 12 | `pr_merge_rate` | float | 0–1.0 | `/pulls` | Merged PRs / total PRs (last 6 months) |
| 13 | `stale_pr_ratio` | float | 0–1.0 | `/pulls` | Open PRs with no activity >30 days / total PRs |
| 14 | `days_since_last_release` | float | 0–730 | `/releases` | Days since most recent release tag |
| 15 | `release_freq_trend_slope` | float | -30 to +30 | `/releases` | Slope of inter-release intervals (positive = releases slowing) |
| 16 | `repo_age_days` | float | 0–5000 | `/repos/{owner}/{repo}` | Days since repository was created |
| 17 | `is_archived` | float | 0 or 1 | `/repos/{owner}/{repo}` | 1 if repository is archived on GitHub |
| 18 | `days_since_maintainer_comment` | float | 0–365 | Estimated from releases + issues | Proxy for days since last maintainer engagement |

**Feature defaults on API failure:**

| Feature | Default | Rationale |
|---|---|---|
| `commit_freq_mean_52w` | 0.0 | Unknown = treat as inactive |
| `commit_freq_trend_slope` | 0.0 | Neutral |
| `is_archived` | 0.0 | Unknown, don't assume archived |
| `repo_age_days` | 365.0 | Assume 1 year old |
| All others | 0.0 | Neutral default |

### 7.4 Model Architecture

**Algorithm:** XGBoost multi-class classifier (`XGBClassifier`)

**Hyperparameters:**

```python
XGBClassifier(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.04,
    subsample=0.8,
    colsample_bytree=0.75,
    min_child_weight=3,
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    scale_pos_weight=2,
    objective="multi:softprob",
    num_class=3,
    eval_metric="mlogloss",
    early_stopping_rounds=20,
    random_state=42,
    n_jobs=-1
)
```

**Rationale for key hyperparameters:**

- `max_depth=5`: Prevents overfitting on the relatively small dataset while capturing feature interactions
- `scale_pos_weight=2`: Addresses class imbalance (Dying class underrepresented)
- `subsample=0.8` + `colsample_bytree=0.75`: Regularization via random sampling
- `early_stopping_rounds=20`: Prevents overfitting; training stops when validation mlogloss stops improving

**Training procedure:**

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, stratify=y, random_state=42
)

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False
)
```

**Saved artifacts:**

| File | Contents | Load with |
|---|---|---|
| `ml/models/compass_model.joblib` | Trained XGBClassifier | `joblib.load()` |
| `ml/models/compass_explainer.joblib` | `shap.TreeExplainer` | `joblib.load()` |
| `ml/models/feature_names.joblib` | Ordered list of 18 feature names | `joblib.load()` |
| `ml/models/training_metadata.json` | Accuracy, F1, training date, dataset size | `json.load()` |

### 7.5 Evaluation Targets

| Metric | Minimum | Target |
|---|---|---|
| Overall accuracy | 84% | 88% |
| F1-score macro | 0.82 | 0.86 |
| Precision (Dying) | 85% | 89% |
| Recall (Dying) | 83% | 87% |
| Precision (At Risk) | 78% | 82% |
| False positive rate (Dying) | < 15% | < 11% |

### 7.6 SHAP Output Contract

`shap_chart_data` in every package result is a list of dicts, sorted by `abs(shap)` descending, limited to the top 10 features:

```json
[
  {
    "feature": "top_contributor_pct",
    "shap": 0.621,
    "value": 97.2,
    "feature_display": "Contributor concentration"
  },
  {
    "feature": "commit_freq_trend_slope",
    "shap": -0.183,
    "value": 2.4,
    "feature_display": "Commit frequency trend"
  }
]
```

Positive `shap` = this feature value increases risk. Negative `shap` = decreases risk.

---

## 8. ChromaDB Configuration

### 8.1 Collection Setup

```python
client = chromadb.PersistentClient(path="./chroma_db")

collection = client.get_or_create_collection(
    name="incident_postmortems",
    metadata={
        "hnsw:space": "cosine",
        "hnsw:construction_ef": 100,
        "hnsw:M": 16
    }
)
```

**HNSW parameters:**
- `hnsw:space = cosine`: Semantic similarity uses cosine distance (1 - cosine similarity)
- `hnsw:construction_ef = 100`: Higher accuracy during index build (default 100)
- `hnsw:M = 16`: Number of connections per node (default 16, good for our corpus size)

### 8.2 Document Schema in ChromaDB

Each document stored in the collection:

| Field | Type | Description |
|---|---|---|
| `id` | string | `f"incident_{global_index}"` |
| `document` | string | Postmortem chunk text (≤ ~600 words) |
| `embedding` | list[float] | 384-dimensional from all-MiniLM-L6-v2 |
| `metadata.url` | string | Source URL of the incident report |
| `metadata.chunk_index` | int | Index of this chunk within the source document |
| `metadata.source_domain` | string | Domain of source (e.g., "blog.cloudflare.com") |

### 8.3 Corpus Size Target

| Metric | Target |
|---|---|
| Unique postmortem sources | 150–200 |
| Total chunks indexed | 3,000–8,000 |
| Embedding model | all-MiniLM-L6-v2 (384 dimensions) |
| Approximate storage | 50–120 MB on disk |

### 8.4 Corpus Rebuild

To rebuild the corpus from scratch:

```bash
python scripts/build_corpus.py
```

Expected runtime: 60-90 minutes (limited by HTTP fetch rate limiting).
Must be run before the first deployment. Add `chroma_db/` to `.gitignore` but document rebuild procedure in README.

---

## 9. Redis Cache Strategy

### 9.1 Cache Key Schema

All keys are prefixed with `gh:` to namespace GitHub API cache entries.

```
gh:{md5(endpoint_path + str(params))}
```

Example:
- Path: `/repos/psf/requests/stats/commit_activity`
- Key: `gh:a3f2c9d1e4b56789...` (32-character MD5 hex)

### 9.2 TTL Values

| Cache type | TTL | Rationale |
|---|---|---|
| GitHub API responses | 21,600s (6 hours) | Behavioral signals don't change on sub-hour timescales |
| Gemini report (by manifest hash) | 3,600s (1 hour) | Avoid duplicate LLM calls for identical manifests |

### 9.3 Cache-aside Pattern

```
1. Hash request key
2. GET from Redis
3. If HIT: return deserialized data
4. If MISS: make API call
5. SET in Redis with TTL
6. Return data
```

Exceptions:
- Redis `GET` failure: log warning, make API call without caching (degrade gracefully)
- Redis `SET` failure: log warning, return data without caching

---

## 10. Error Handling

### 10.1 Error Hierarchy

```
CompassError (base)
├── GitHubError
│   ├── GitHubRateLimitError (403)
│   ├── GitHubNotFoundError (404)
│   └── GitHubTimeoutError (timeout after retries)
├── ModelError
│   ├── ModelNotLoadedError (joblib file missing)
│   └── PredictionError (XGBoost inference failure)
├── ChromaDBError
│   └── ChromaDBUnavailableError
├── GeminiFallbackException
│   └── Triggers structured text fallback
└── ManifestParseError
    ├── UnsupportedFormatError
    └── EmptyManifestError
```

### 10.2 Error Handling Per Layer

| Layer | Error | Behavior |
|---|---|---|
| Signal Collector | GitHubRateLimitError | Mark package as unanalyzable, send WebSocket error for that package |
| Signal Collector | GitHubNotFoundError | Mark package as "No GitHub source" |
| Signal Collector | Any exception | Default feature values, continue analysis |
| Risk Classifier | ModelNotLoadedError | Service startup failure (fail fast) |
| Risk Classifier | PredictionError | Log error, return risk_class="Unknown" |
| Incident Retriever | ChromaDBUnavailableError | Return empty incidents list, do not crash |
| Report Generator | GeminiFallbackException | Return structured markdown report from data |
| WebSocket Handler | Client disconnects mid-stream | Cancel analysis task, clean up |
| WebSocket Handler | Any unhandled exception | Send error message, close connection cleanly |

### 10.3 Logging Standard

All log lines follow the format:
```
{timestamp} {level} {component} {message} {optional_context_dict}
```

Example:
```
2026-06-01T14:32:01Z INFO signal_collector Resolved package github_repo=psf/requests package=requests
2026-06-01T14:32:03Z WARN github_client 202 on stats endpoint, retrying attempt=2 path=/repos/psf/requests/stats/commit_activity
2026-06-01T14:32:05Z ERROR risk_classifier Prediction failed package=some-package error=feature_shape_mismatch
```

---

## 11. Performance Specifications

### 11.1 Per-Package Analysis Time Budget

| Step | Budget |
|---|---|
| GitHub repo resolution (PyPI/npm lookup) | 1,000ms |
| GitHub API parallel calls (8 endpoints) | 4,000ms (parallel, not serial) |
| Feature computation | 50ms |
| XGBoost prediction + SHAP | 200ms |
| ChromaDB incident retrieval | 300ms |
| **Total per package** | **~5,500ms** |

With `asyncio.Semaphore(5)` allowing 5 concurrent packages: a 20-package manifest completes in approximately `⌈20/5⌉ × 5,500ms = 22,000ms` ≈ 22 seconds under warm cache. First-run (cold cache) may take up to 45 seconds.

### 11.2 Memory Budget (Railway Free Tier: 512MB)

| Component | Estimated Memory |
|---|---|
| XGBoost model | ~15MB |
| SHAP explainer | ~5MB |
| sentence-transformers model (all-MiniLM-L6-v2) | ~90MB |
| FastAPI + uvicorn workers (2) | ~80MB |
| ChromaDB in-memory cache | ~50MB |
| Python overhead + libraries | ~100MB |
| **Total** | **~340MB** |

Buffer: ~170MB available for request processing. Sufficient for 5 concurrent WebSocket connections.

### 11.3 Database Query SLAs

| Query | Target |
|---|---|
| `INSERT` into analyses | < 50ms |
| `INSERT` 25 package_results | < 200ms |
| `SELECT` last 10 analyses with packages | < 100ms |

All database operations are async (asyncpg) and run as background tasks after the WebSocket closes — they do not block the user-facing response.

---

## 12. Security Implementation

### 12.1 Environment Variables

```bash
# .env.example
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
REDIS_URL=redis://localhost:6379
SECRET_KEY=generate-with-openssl-rand-hex-32
```

Rules:
- `.env` is in `.gitignore`
- `.env.example` contains only placeholder values
- All secrets are read via `os.environ["VAR_NAME"]` — explicit access, no silent defaults for secret values
- Non-secret config (port, log level) may use `os.environ.get("VAR", default)`

### 12.2 Input Validation

All inputs validated with Pydantic v2:

```python
class ManifestUpload(BaseModel):
    content: str = Field(max_length=100_000)  # 100KB limit
    filename: str = Field(pattern=r'^[a-zA-Z0-9_\-\.]+$', max_length=255)

    @field_validator("filename")
    def validate_extension(cls, v: str) -> str:
        if not (v.endswith(".txt") or v.endswith(".json")):
            raise ValueError("Only .txt and .json files are accepted")
        return v
```

### 12.3 CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",         # Local development
        "https://compass.vercel.app",   # Production frontend
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False
)
```

### 12.4 Rate Limiting (v1.1)

To be implemented in v1.1 using `slowapi`:
- `POST /analyze/parse`: 20 requests per hour per IP
- `GET /package/{name}`: 60 requests per hour per IP
- WebSocket connections: 3 concurrent per IP

---

## 13. Deployment Architecture

### 13.1 Services

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    volumes:
      - chroma_data:/app/chroma_db
      - model_data:/app/ml/models
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: compass
      POSTGRES_PASSWORD: compass
      POSTGRES_DB: compass

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 20mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
  chroma_data:
  model_data:
```

### 13.2 Application Startup Sequence

```python
@app.on_event("startup")
async def startup():
    # 1. Verify model files exist — fail fast if missing
    assert os.path.exists("ml/models/compass_model.joblib"), \
        "Model not found. Run: python ml/train.py"

    # 2. Load model and explainer into module-level variables
    import agents.risk_classifier  # triggers module-level joblib.load()

    # 3. Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 4. Verify Redis connection
    await redis_client.ping()

    # 5. Verify ChromaDB collection exists
    # (does not fail if missing — incidents section degrades gracefully)
    try:
        client.get_collection("incident_postmortems")
    except Exception:
        logger.warning("ChromaDB incident corpus not found. Incidents section disabled.")

    logger.info("Compass startup complete")
```

### 13.3 Railway Deployment Steps

```bash
# Step 1: Push to GitHub
git push origin main

# Step 2: Railway setup (one-time)
railway login
railway init
railway add --plugin postgresql
railway add --plugin redis

# Step 3: Set environment variables
railway variables set GITHUB_TOKEN=ghp_xxx
railway variables set GEMINI_API_KEY=AIzaSy_xxx

# Step 4: Deploy
railway up

# Step 5: Get public URL
railway open
```

### 13.4 Pre-Deployment Checklist

- [ ] `python ml/train.py` completed successfully with accuracy ≥ 86%
- [ ] `python scripts/build_corpus.py` completed with ≥ 3,000 chunks indexed
- [ ] All 3 model files present in `ml/models/`
- [ ] `chroma_db/` directory present and non-empty
- [ ] `.env` contains all required variables
- [ ] `docker-compose up` starts all services cleanly
- [ ] `/health` endpoint returns `model_loaded: true`
- [ ] Demo manifest analyzed successfully end-to-end
- [ ] Frontend builds without errors: `npm run build`
- [ ] Frontend deployed to Vercel: `vercel --prod`
- [ ] WebSocket URL in frontend points to Railway URL (not localhost)

---

## 14. Testing Strategy

### 14.1 Backend Unit Tests

**Location:** `backend/tests/`

**Coverage target:** 70% minimum

| Module | Test type | Key test cases |
|---|---|---|
| `core/github_client.py` | Unit + mock | Cache hit returns cached data; 202 triggers retry; 404 returns {} |
| `ml/features.py` | Unit | Feature extraction from sample API responses; default values on empty input |
| `agents/risk_classifier.py` | Unit | Known healthy repo → score < 40; known archived repo → score > 70; SHAP output has expected keys |
| `agents/incident_retriever.py` | Integration | ChromaDB query returns results above threshold; empty ChromaDB returns [] |
| `routes/analyze.py` | Integration | WebSocket sends `start` → N `package_result` → `complete` messages |

**Fixtures:**
- `tests/fixtures/healthy_repo_signals.json` — sample features for a known-healthy repo
- `tests/fixtures/dying_repo_signals.json` — sample features for a known-archived repo
- `tests/fixtures/sample_requirements.txt` — 5-package test manifest

### 14.2 ML Model Validation Tests

Run after every training run:

```python
def test_known_packages():
    """Verify model makes expected predictions on known packages."""
    # requests (psf/requests) — should be Healthy
    signals = collect_signals_sync("psf", "requests")
    result = classify_package(signals)
    assert result["risk_class"] == "Healthy"
    assert result["risk_score"] < 40

    # faker.js (deleted/sabotaged) — if using historical snapshot, should be Dying
    # Verify overall accuracy from held-out test set
    assert training_metadata["accuracy"] >= 0.86
    assert training_metadata["f1_macro"] >= 0.82
```

### 14.3 Integration Test: Full Analysis Pipeline

```bash
# Run full pipeline against a 3-package test manifest
pytest tests/integration/test_full_pipeline.py -v

# What it tests:
# 1. POST /analyze/parse returns 3 packages
# 2. WebSocket receives start, 3x progress, 3x package_result, complete
# 3. Each package_result has expected keys
# 4. At least 1 package resolves to a GitHub repo
# 5. Complete message has correct summary counts
```

### 14.4 Frontend Tests

Manual test checklist (automated testing deferred to v1.1):

- [ ] Upload `requirements.txt` → package count displays correctly
- [ ] Cards populate in real time (not all at once after delay)
- [ ] Clicking a card shows SHAP chart
- [ ] SHAP chart: positive values in red, negative in green
- [ ] Incident panel shows for At Risk / Dying packages
- [ ] Report streams token by token (not a single block)
- [ ] Error state (invalid file) shows correct message
- [ ] Works on Chrome, Firefox, Safari

---

## 15. Monitoring

### 15.1 Structured Logging (Production)

Log to stdout in JSON format for Railway's log aggregation:

```python
import structlog
log = structlog.get_logger()

log.info("analysis_complete",
    manifest=filename,
    packages_analyzed=len(results),
    dying=dying_count,
    at_risk=at_risk_count,
    duration_ms=round((time.time() - start) * 1000)
)
```

### 15.2 Key Metrics to Monitor

| Metric | Source | Alert threshold |
|---|---|---|
| Analysis success rate | Logs | < 90% success |
| Mean analysis duration | Logs | > 60 seconds |
| GitHub API 403 rate | Logs | > 5% of calls |
| Redis cache hit rate | Logs | < 40% (indicates cold cache problem) |
| Gemini fallback rate | Logs | > 20% (indicates Gemini reliability issue) |
| Model prediction error rate | Logs | > 0% (any model error is unexpected) |

### 15.3 Health Check Integration

Railway automatically polls `GET /health` every 30 seconds. If it returns 503 three consecutive times, Railway restarts the service.

Uptime monitoring: Use UptimeRobot (free tier) to monitor `GET /health` from external network. Alert via email if service is unreachable.
