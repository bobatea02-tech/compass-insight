# Compass — Product Requirements Document

| Field | Value |
|---|---|
| Product Name | Compass |
| Tagline | Know before your dependencies die |
| Version | 1.0 (MVP) |
| Status | Draft |
| Author | Parthi Gadher |
| Last Updated | June 2026 |
| Reviewers | — |

---

## Table of Contents

1. Executive Summary
2. Problem Statement and Opportunity
3. Goals and Non-Goals
4. Success Metrics
5. User Personas
6. User Journeys
7. Feature Requirements
8. Non-Functional Requirements
9. Security and Privacy
10. Dependencies and Constraints
11. Risks and Mitigations
12. Open Questions
13. Revision History

---

## 1. Executive Summary

Compass is an AI-powered open source dependency health intelligence system. It takes any `requirements.txt` or `package.json` file, queries the GitHub API for behavioral signals from each dependency's repository, runs them through a trained XGBoost abandonment classifier, and returns a real-time risk dashboard showing which packages are at risk of maintainer abandonment — before it happens.

The core insight Compass is built on: **package abandonment has detectable behavioral precursors 6-12 months before it occurs.** Commit message sentiment deteriorates. Contributor concentration increases. Issue response times lengthen. Stale PR ratios climb. These signals are measurable from public GitHub data, and an ML model trained on thousands of historically labeled repositories can identify them with 86%+ accuracy.

Existing tools (Libraries.io, OSSF Scorecard, Socket.dev, Snyk) tell you a package IS compromised or dead. Compass tells you which packages are BECOMING compromised — giving teams the lead time to evaluate alternatives, pin versions, or fork before a production incident forces their hand.

**Scope of v1.0:** Web interface for on-demand analysis of uploaded manifests. No accounts required. Four-agent pipeline: Signal Collector, Risk Classifier, Incident Retriever, Report Generator. Deployment on Railway (backend) and Vercel (frontend).

---

## 2. Problem Statement and Opportunity

### 2.1 The Problem

Every software project depends on open source packages it did not write and does not control. When a package is abandoned by its maintainer, downstream projects face three compounding risks:

**Security risk.** Unpatched CVEs accumulate in unmaintained packages. The average time from CVE disclosure to patch in an abandoned package is infinite — the patch never comes.

**Operational risk.** Dependencies of the abandoned package continue releasing new versions. Compatibility breaks silently. CI pipelines fail unexpectedly months after the original abandonment.

**Velocity risk.** Engineers spend unplanned hours debugging behavior caused by stale transitive dependencies. This cost is invisible in planning cycles because it is reactive.

### 2.2 Why Existing Tools Miss This

Current tooling is either reactive or static:

| Tool | What it detects | What it misses |
|---|---|---|
| Libraries.io | Last commit date, star count | Leading behavioral indicators |
| OSSF Scorecard | Security hygiene (CI, code review) | Maintainer burnout trajectory |
| Snyk / Socket.dev | Known CVEs, malicious code | Abandonment before it happens |
| Dependabot | Version updates | Whether the new version has an active maintainer |
| GitHub Insights | Activity graphs | No predictive model, no aggregated risk view |

None of these tools answer the question developers actually need answered: **"Which of my current dependencies will not have an active maintainer in 18 months?"**

### 2.3 The Opportunity

The data needed to answer this question is entirely public. GitHub exposes commit history, issue threads, contributor statistics, PR activity, and release cadence for every public repository — for free, via authenticated API. No proprietary data is required.

Academic research (Coelho et al., 2018; multiple ICSE and FSE papers) has validated that behavioral signals from version control systems predict project abandonment with statistical significance. No production tool has operationalized this research into an interactive, real-time system accessible to individual developers.

**India context:** India added 5.2 million developers to GitHub in 2025, making it the second-largest contributor country globally. Indian engineering teams at product companies (Razorpay, CRED, Zerodha, Persistent, Mphasis) build heavily on open source Python and JavaScript ecosystems and have no purpose-built tool for dependency health beyond ad-hoc manual checks.

### 2.4 Target Problem Size

- 500,000+ Python packages on PyPI; average project uses 30-50 direct dependencies
- 2.3 million npm packages; average Node.js project uses 40-80 direct dependencies
- Estimated 8% of top-10,000 PyPI packages show at-risk signals at any given time
- Average cost of an unplanned dependency-related production incident: 4-8 engineering hours

---

## 3. Goals and Non-Goals

### 3.1 Goals for v1.0

**G1.** Analyze any `requirements.txt` or `package.json` uploaded by a user and return a per-package risk classification (Healthy / At Risk / Dying) within 45 seconds for a 20-package manifest.

**G2.** Display SHAP feature attributions that explain, in human-readable language, exactly which behavioral signals drove each package's risk score.

**G3.** Retrieve and surface relevant historical incident postmortems from public engineering blogs that involved packages similar to flagged dependencies.

**G4.** Generate a streamed natural-language dependency health report summarising findings and providing actionable next steps.

**G5.** Persist analysis history in PostgreSQL so users can track how package risk scores change across multiple analyses over time.

**G6.** Deploy to a publicly accessible URL with a live demo available at all times.

### 3.2 Non-Goals for v1.0

**NG1.** User accounts, authentication, or any form of user identity management.

**NG2.** Real-time monitoring or scheduled re-analysis. Users trigger analyses manually.

**NG3.** Analysis of private GitHub repositories. All signal collection is limited to public repos.

**NG4.** Analysis of transitive dependencies (only direct dependencies in the manifest are analyzed in v1.0).

**NG5.** Integration with CI/CD pipelines. v1.0 is a web interface only.

**NG6.** Support for package ecosystems other than PyPI (requirements.txt) and npm (package.json). Maven, Cargo, Go modules are out of scope.

**NG7.** Automated alerting or notifications of any kind.

---

## 4. Success Metrics

### 4.1 ML Model Quality (Primary Technical Metric)

| Metric | Target | Rationale |
|---|---|---|
| Overall accuracy | ≥ 86% | Benchmark against OSSF static metrics baseline (~71%) |
| Precision on "Dying" class | ≥ 87% | False positives cause unnecessary migration work |
| Recall on "Dying" class | ≥ 85% | False negatives allow real risk to go undetected |
| Precision on "At Risk" class | ≥ 80% | Leading indicator — acceptable to be slightly less precise |
| F1-score (macro) | ≥ 0.84 | Overall balance across three classes |

### 4.2 System Performance

| Metric | Target |
|---|---|
| Time to first package result | < 8 seconds |
| Full analysis of 20 packages | < 45 seconds |
| GitHub API cache hit rate | > 60% (for re-analyses of same packages) |
| WebSocket connection stability | Zero drops under 5 concurrent sessions |
| SHAP chart render time | < 500ms after receiving package result |

### 4.3 Demo Quality (Placement-Specific Metric)

| Metric | Target |
|---|---|
| Demo from upload to full report | < 90 seconds total |
| Packages requiring manual fallback | 0 (all packages resolve to GitHub owner/repo automatically) |
| Number of known packages with confirmed non-trivial risk scores | ≥ 3 from the standard demo manifest |

### 4.4 Code Quality

| Metric | Target |
|---|---|
| Test coverage (backend) | ≥ 70% |
| Type annotation coverage | 100% on all public functions |
| Linting (ruff + mypy) | Zero errors |
| Docker build success | Reproducible from clean clone in < 5 minutes |

---

## 5. User Personas

### Persona 1 — Aryan, Junior Backend Developer

**Background:** 1.5 years of experience, works at a 60-person SaaS startup in Bangalore. Writes Python FastAPI services. Has had one production incident caused by a transitive dependency conflict after a teammate upgraded a library without checking downstream effects.

**Pain points:**
- Has no systematic way to evaluate package health when adding new dependencies
- Doesn't know which of his current dependencies are healthy vs slowly dying
- Spends time on Stack Overflow trying to understand why a library's behavior changed

**Goal:** Pick reliable dependencies when starting a new service and get early warning when existing ones are degrading.

**How Aryan uses Compass:** Before starting a new project, runs Compass on a candidate `requirements.txt` to compare the health of similar libraries. Once a month, runs Compass on his production service's manifest to check for new risk signals.

**What makes Aryan the demo persona:** His use case is immediately relatable to any software engineer interviewing. Compass solves a problem Aryan has felt personally.

---

### Persona 2 — Meera, Senior SRE / Platform Engineer

**Background:** 7 years of experience. Responsible for the platform reliability of a 300-person fintech company in Mumbai. Runs post-mortems every time there is a production incident. Has traced two incidents in the past year to abandoned or poorly maintained open source libraries.

**Pain points:**
- No visibility into dependency health across the 40+ microservices her team maintains
- Incident post-mortems keep citing "unmaintained dependency" as a root cause with no upstream prevention
- Wants to present a proactive dependency risk story to her VP Engineering

**Goal:** Shift from reactive incident response to proactive dependency risk management.

**How Meera uses Compass:** Runs batch analysis on every service's manifest quarterly. Reviews the "At Risk" and "Dying" reports in leadership reviews as part of platform health metrics.

---

### Persona 3 — Vikram, Engineering Manager

**Background:** 10 years of experience, currently managing a team of 8 engineers at a Bangalore product company. Does not write production code daily but approves technology choices and has accountability for system reliability.

**Pain points:**
- Cannot distinguish between "this package is mature and stable" and "this package has one stressed maintainer who is about to quit"
- Wants data to back technology decisions in architecture reviews
- Worries about key-person risk in dependencies (single maintainer packages)

**Goal:** Make evidence-based dependency decisions with quantified risk data.

**How Vikram uses Compass:** Reviews Compass reports as part of quarterly architecture reviews. Uses the "contributor concentration" signal specifically as a proxy for key-person dependency risk — a concept he already understands from team management applied to open source packages.

---

## 6. User Journeys

### Journey 1 — First-time analysis (Aryan)

```
Step 1: Aryan opens Compass at the public URL
        → Sees upload panel and a "Try with example manifest" button

Step 2: He uploads requirements.txt from his current project (20 packages)
        → Upload accepted, "Analyzing 20 packages..." appears
        → Progress indicator shows "Analyzing fastapi (3/20)"

Step 3: Package cards populate in real time as each analysis completes
        → 17 cards show green (Healthy)
        → 2 cards show amber (At Risk)
        → 1 card shows red (Dying)

Step 4: Aryan clicks the red package card
        → SHAP chart appears: "Top risk signal: 94% of commits are from one contributor"
        → Incident panel shows: Cloudflare incident reference where a similar 
           single-maintainer package caused a 2-hour outage
        
Step 5: Full report streams in the right panel
        → "Executive Summary: 3 of 20 packages show elevated risk..."
        → "Recommendation: Pin event-emitter to 3.0.2 and evaluate eventemitter3 as alternative"

Step 6: Aryan downloads report or copies the risk summary
        → Shares with his team lead as justification for a dependency migration ticket

Total time: 35-50 seconds from upload to full report
```

### Journey 2 — Demo for interview (Parthi)

```
Step 1: Parthi finds the interviewer's company on GitHub
        → Locates their public backend service or open-source project
        → Downloads or copies their requirements.txt / package.json

Step 2: Opens Compass live in the interview
        → "Let me show you your own dependencies analyzed in real time"

Step 3: Uploads their manifest
        → Packages stream in as they complete

Step 4: Clicks the highest-risk package
        → SHAP chart identifies the specific behavioral signals
        → Interviewer sees their own codebase's risk visualized

Step 5: Explains the ML model when asked
        → "XGBoost trained on 5,000 labeled repos — SHAP shows exactly which signal 
           drove the prediction. Commit message sentiment drift was the second-most 
           predictive feature after frequency decline."

Outcome: Interviewer recognizes a product problem they personally experience
```

### Journey 3 — Returning user (Meera)

```
Step 1: Meera returns to Compass 30 days after her first analysis
        → Uploads the same service manifest she analyzed previously

Step 2: Results appear, system notes packages that changed risk class
        → "requests: was Healthy, now At Risk"
        → Reason: contributor concentration increased from 72% to 89% last month

Step 3: Meera exports comparison (v1.1 feature — not in MVP)
        → Creates ticket to evaluate urllib3 as an alternative for internal HTTP calls
```

---

## 7. Feature Requirements

### Priority Definitions
- **P0:** Required for MVP launch. Compass does not ship without these.
- **P1:** Required for v1.1 (within 4 weeks post-MVP).
- **P2:** Future roadmap (v2.0+).

---

### 7.1 P0 Features — MVP

#### F-001: Manifest File Upload

**Description:** Users can upload a `requirements.txt` or `package.json` file via drag-and-drop or file picker. The system parses the file and extracts a list of direct dependency names.

**Acceptance criteria:**
- Accepts `.txt` and `.json` file extensions only
- Parses `requirements.txt`: extracts package names stripping version specifiers (`>=`, `==`, `~=`, `[extras]`)
- Parses `package.json`: extracts keys from `dependencies` and `devDependencies` objects
- Handles malformed files gracefully: skips unparseable lines, does not crash
- Displays parsed package count before analysis begins: "Found 23 packages"
- Caps analysis at 25 packages per request in MVP (performance constraint)
- Maximum file size: 100KB

---

#### F-002: GitHub Repository Resolution

**Description:** For each package name, Compass resolves the corresponding GitHub repository owner/repo string by querying the package registry API.

**Acceptance criteria:**
- For PyPI packages: queries `https://pypi.org/pypi/{name}/json` and extracts GitHub URL from `project_urls`
- For npm packages: queries `https://registry.npmjs.org/{name}/latest` and extracts `repository.url`
- Handles packages with no GitHub link: marks as "No GitHub source" with risk score N/A
- Handles packages whose GitHub URL points to an organization mirror (not the canonical repo): resolves to canonical where detectable
- Resolution failure for any single package does not halt analysis of remaining packages

---

#### F-003: Behavioral Signal Collection

**Description:** For each resolved repository, the Signal Collector agent queries 8 GitHub API endpoints in parallel and computes 18 behavioral features.

**Acceptance criteria:**
- All 8 API calls execute concurrently via `asyncio.gather()`
- Each call is routed through the Redis cache layer; TTL = 21,600 seconds (6 hours)
- The `/stats/commit_activity` endpoint is retried up to 3 times with 1.5s delay on 202 response
- 404 responses are handled gracefully: feature defaults to a neutral/unknown value, not a crash
- All 18 features are computed and returned as a flat dict with float values
- Features are described in full in Section 4 of the Technical Specifications document

---

#### F-004: XGBoost Risk Classification with SHAP

**Description:** The Risk Classifier agent takes the 18 computed features and returns a risk class (Healthy / At Risk / Dying), a risk score (0-100), confidence percentage, probability breakdown across three classes, and SHAP feature attributions for the top 10 features.

**Acceptance criteria:**
- Model loads from disk at application startup, not per-request
- SHAP explainer loads from disk at application startup
- Prediction + SHAP computation completes in < 200ms per package
- Risk score formula: `round(P(At Risk) * 50 + P(Dying) * 100)`
- SHAP chart data includes all features sorted by absolute SHAP value, limited to top 10
- Top-3 signals include human-readable explanation strings (not just feature names)
- If model file is missing: service startup fails fast with a clear error message

---

#### F-005: Incident Postmortem Retrieval

**Description:** For packages classified as At Risk or Dying, the Incident Retriever agent queries ChromaDB for the 3 most semantically similar incident postmortem excerpts.

**Acceptance criteria:**
- Query is constructed as: `"{package_name} {top_signal_1} {top_signal_2} production incident"`
- Only incidents with cosine similarity > 0.30 are returned
- Each result includes: excerpt (≤ 400 characters), source URL, similarity score
- If ChromaDB is unavailable or returns no results above threshold: returns empty list, does not crash
- Incident retrieval only executes for packages with risk_score ≥ 50

---

#### F-006: Streaming Analysis via WebSocket

**Description:** Analysis results stream from server to client in real time. Each package result is sent as soon as it completes — not after all packages are processed.

**Acceptance criteria:**
- WebSocket connection established at `/ws/analyze`
- Client sends: `{content: string, filename: string}` as JSON
- Server sends messages of the following types (see Technical Specs for full protocol):
  - `start`: total package count
  - `progress`: current package being analyzed
  - `package_result`: full result for one completed package
  - `generating_report`: signal that LLM report is beginning
  - `report_token`: single streaming token from Gemini
  - `complete`: summary statistics
  - `error`: any unrecoverable failure
- If WebSocket connection drops mid-analysis: server cleans up resources gracefully
- Client reconnection attempt: 3 retries with exponential backoff

---

#### F-007: Risk Dashboard UI

**Description:** The React frontend displays a grid of package cards that populate in real time as each package's analysis completes. Each card shows risk class, score, and top signal summary.

**Acceptance criteria:**
- Cards appear one by one as `package_result` messages arrive (not all at once)
- Risk color coding: green for Healthy (score 0-39), amber for At Risk (40-69), red for Dying (70-100)
- Each card shows: package name, risk score as a circular indicator, risk class badge, top-1 signal sentence
- Clicking a card opens the detail view (F-008)
- Overall summary counts (X healthy / Y at risk / Z dying) update live as cards populate
- Empty state: "Analyzing..." animation while no results have arrived yet
- Error state: clear message per failed package, does not block other packages from displaying

---

#### F-008: SHAP Explanation Detail View

**Description:** Clicking any package card opens a detail panel showing the SHAP waterfall chart and incident postmortems for that package.

**Acceptance criteria:**
- SHAP chart is a horizontal bar chart (Recharts `BarChart`)
- Positive SHAP value (increases risk) → red bar
- Negative SHAP value (decreases risk) → green bar
- Feature names are shown in human-readable form (not raw snake_case)
- Feature raw values shown alongside SHAP values
- If package has incidents: show up to 3 incident cards, each with excerpt text and a "Source" link
- Detail panel is closeable and does not interrupt ongoing analysis stream

---

#### F-009: Streaming Report

**Description:** After all packages are analyzed, a natural language report is generated by Gemini and streamed token-by-token to the right panel.

**Acceptance criteria:**
- Report generation begins only after all package analyses complete
- Tokens stream and appear progressively in the UI (not a loading spinner until the full report arrives)
- Report contains: Executive Summary (2 sentences), Package Analysis (one paragraph per high-risk package), Recommendations (numbered list)
- If Gemini API fails: display a structured text summary from the structured data instead (fallback)
- Report is copyable to clipboard via a single button

---

#### F-010: Analysis Persistence

**Description:** Every analysis is saved to PostgreSQL for history tracking.

**Acceptance criteria:**
- Each analysis saved: manifest filename, package count, risk summary counts, timestamp
- Each package result saved: package name, risk score, risk class, top signals (JSONB), GitHub repo
- History endpoint returns last 10 analyses: `GET /history`
- No user identity is stored (all analyses are anonymous in v1.0)
- Analysis save failure does not affect the user-facing response

---

### 7.2 P1 Features — v1.1

#### F-011: Risk Delta Tracking

When a user submits the same manifest twice, Compass compares the results and highlights packages whose risk class changed since the last analysis. Surface as: "requests: Healthy → At Risk (change detected 2024-01-15)".

#### F-012: Dependency Graph Visualization

A D3.js force-directed graph showing all analyzed packages as nodes, colored by risk class, with edges showing which packages share common transitive dependencies. Risk clusters become visually obvious.

#### F-013: CI/CD API Endpoint

`POST /api/analyze` with an API key in the header. Returns structured JSON suitable for use in CI pipeline gate checks. Exit code 1 if any package is classified as Dying.

#### F-014: Email Report Export

"Send report to email" button that sends a formatted HTML email with the full analysis. Uses a free transactional email service (Resend or Mailgun free tier).

---

### 7.3 P2 Features — v2.0

#### F-015: GitHub App Integration

Install Compass as a GitHub App. Automatically analyze dependency manifests on every PR that modifies `requirements.txt` or `package.json`. Post a comment with risk summary.

#### F-016: Threshold Alerting

Configurable thresholds. If a previously-analyzed package's risk score crosses a user-defined threshold (e.g., crosses from Healthy to At Risk), send a notification.

#### F-017: Organization-wide Package Registry

For enterprise users: scan all repositories in a GitHub organization and produce a unified dependency health report across all services.

#### F-018: Custom Risk Weight Configuration

Allow users to adjust the relative weighting of risk signals. For example, an SRE team might weight "days since last release" more heavily than "commit sentiment."

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Requirement | Specification |
|---|---|
| Time to first package result | < 8 seconds from WebSocket connection |
| Full analysis of 20-package manifest | < 45 seconds P95 |
| GitHub API cache hit rate | > 60% for re-analyzed packages within 6-hour TTL |
| SHAP computation per package | < 200ms |
| WebSocket reconnect time | < 3 seconds |
| Frontend initial load (LCP) | < 2 seconds on 4G connection |
| Report streaming start | < 2 seconds after analysis completes |

### 8.2 Reliability

| Requirement | Specification |
|---|---|
| Uptime target | 99% (Railway free tier best-effort) |
| Single package failure isolation | One failed package does not halt remaining analysis |
| GitHub API outage handling | Graceful degradation — return cached data or skip with notification |
| ChromaDB unavailability | Incidents section hidden; rest of analysis proceeds |
| Gemini API failure | Structured text fallback report generated from structured data |

### 8.3 Scalability (v1.0 targets)

| Requirement | Specification |
|---|---|
| Concurrent WebSocket sessions | 10 simultaneous users |
| GitHub API rate limit headroom | 5,000 req/hr authenticated; Redis caching maintains headroom |
| ChromaDB corpus size | Up to 50,000 postmortem chunks |
| PostgreSQL storage | 10,000 analysis records before requiring cleanup |

### 8.4 Maintainability

- All Python code linted with `ruff`, type-checked with `mypy`
- All public functions have docstrings
- Environment variables documented in `.env.example`
- Docker Compose starts the full system with one command
- README includes: setup instructions, architecture diagram, demo walkthrough, and contribution guide

---

## 9. Security and Privacy

### 9.1 Data Handling

- Compass does not store uploaded manifest files. Files are parsed in memory and discarded immediately after package name extraction.
- Package results stored in PostgreSQL contain no user-identifying information (no IP address, no session ID, no email).
- Analysis history is accessible to anyone who knows the API — this is acceptable for v1.0 as a public portfolio project with no sensitive data.

### 9.2 API Key Security

- GitHub Personal Access Token stored as environment variable, never logged, never exposed in API responses
- Gemini API key stored as environment variable
- `.env` file is in `.gitignore`; `.env.example` contains placeholder values only

### 9.3 External API Usage

- All GitHub API calls are read-only on public data. No write operations, no user impersonation.
- PyPI and npm registry queries are read-only and publicly accessible
- Incident postmortem scraping respects `robots.txt` and includes a `User-Agent: Compass/1.0 Research` header

### 9.4 Rate Limiting

- Frontend: no rate limiting on the web interface for v1.0
- Backend `POST /api/analyze` (P1 CI/CD endpoint): 10 requests per hour per IP
- GitHub API: Redis caching prevents repeated calls for the same packages within 6-hour windows

---

## 10. Dependencies and Constraints

### 10.1 External Service Dependencies

| Service | Purpose | Constraint |
|---|---|---|
| GitHub API | Signal collection | 5,000 req/hr authenticated; cache reduces effective demand |
| PyPI JSON API | Package → GitHub resolution | No rate limit documented; treat conservatively |
| npm Registry API | Package → GitHub resolution | No rate limit documented |
| Gemini API | Report generation | Free tier: 15 RPM, 1M tokens/day |
| Railway | Backend hosting | Free tier: $5 credit/month, sleeps after inactivity |
| Vercel | Frontend hosting | Free tier: 100GB bandwidth/month |
| danluu/post-mortems | Incident corpus source | Static GitHub file; content may change over time |

### 10.2 Technical Constraints

- XGBoost model must fit in Railway's free tier memory (512MB RAM limit)
- ChromaDB must use persistent local storage (no cloud ChromaDB in free tier)
- All 8 GitHub API calls per package must complete within the Railway 30-second request timeout
- Frontend must work without JavaScript build tools if Vite is unavailable (fallback to CDN-hosted React)

### 10.3 Timeline Constraints

- MVP must be buildable in 7 days of focused work
- Model training must complete on a laptop CPU in < 2 hours (no GPU requirement)
- Incident corpus must be buildable with free API access only

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GitHub API rate limiting during demo | Medium | High | Redis caching; prepare demo with pre-cached packages; run demo manifest through once before interview |
| Package with no GitHub source | High (15-20% of packages) | Medium | Graceful skip with "No GitHub source" label; ensure demo manifest uses packages that all resolve |
| XGBoost model below 86% accuracy target | Medium | High | Increase training data to 10,000 repos; tune hyperparameters; adjust class boundaries |
| Gemini API free tier rate limit hit during demo | Low | High | Pre-generate report for demo manifest; cache in Redis; have offline fallback |
| Railway free tier sleep delay (30s cold start) | High | Medium | Wake Railway instance before demo; display loading state in frontend |
| ChromaDB local storage not persisting across Railway redeploys | Medium | Medium | Mount persistent volume in docker-compose; document re-indexing procedure |
| Incident postmortem URLs going 404 | Medium | Low | Filter at corpus build time; store extracted text, not links |
| Interview question about a training data detail Parthi doesn't know | Medium | High | Complete the Feynman test for every ML feature before the interview |

---

## 12. Open Questions

| ID | Question | Owner | Due |
|---|---|---|---|
| OQ-1 | Should the demo manifest be hardcoded or always use the uploaded file? Hardcoded ensures it works; uploaded is more impressive. | Parthi | Day 6 |
| OQ-2 | How to handle packages like `numpy` or `pytorch` that are maintained by foundations with distributed contributor models — standard contributor concentration signal may read as falsely at-risk. | Parthi | Day 2 |
| OQ-3 | Should `devDependencies` in `package.json` be analyzed at the same risk level as production dependencies? Consider separate risk weighting. | Parthi | Day 1 |
| OQ-4 | Is VADER sentiment analysis accurate enough for technical commit messages? Consider fine-tuned alternative. | Parthi | Day 2 |
| OQ-5 | Should "release cadence" signal be weighted differently for libraries (infrequent releases = stable) vs frameworks (infrequent releases = dying)? | Parthi | Day 2 |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | June 2026 | Parthi Gadher | Initial draft |
| 1.0 | June 2026 | Parthi Gadher | Complete PRD for MVP |
