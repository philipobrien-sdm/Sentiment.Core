# Vector-Based Feedback Explorer & Stakeholder Intelligence Engine

A comprehensive, high-performance, full-stack visual analytics application designed to ingest customer comments, public consultation feedback, support tickets, and survey datasets. It converts feedback into high-dimensional text embeddings, provides interactive 2D spatial visualization, performs semantic searches, deduplicates records, and generates stakeholder-prioritized AI executive syntheses.

Built with an **Express + Vite + React (TypeScript)** architecture, it features an offline-first workflow, client-side vector calculations, custom topic clustering, a Stakeholder Power-Interest Matrix, and seamless local LLM integration (Ollama, LM Studio, OpenAI-compatible APIs).

---

## 🚀 Key Major Functions

### 🎯 1. Initial Dataset Context & Calibrated AI Personas
* **Domain Context Calibration:** Set an initial background context or purpose for uploaded CSV datasets (e.g., *Public Policy & Zoning, Product & SaaS, Employee Surveys, Healthcare & Clinical, Higher Education*).
* **Live System Persona Generation:** Automatically adapts the AI system prompt based on the file context to tailor executive syntheses and thematic analysis specifically for your domain.
* **Intelligent Column Mapper:** Features auto-header detection, data preview sampling, and flexible field assignment for Comment Text, Record ID, Date, Sentiment, Topic, and Organization fields.

### 📍 2. Interactive 2D Vector Canvas
* **High-Dimensional Spatial Projections:** Maps feedback text onto a responsive 2D coordinate space derived from vector embeddings.
* **Multi-Dimensional Color Mapping:** Colorize data points dynamically by **Sentiment** (*Positive/Neutral/Negative*), **Topic Clusters**, **Organization**, or **Stakeholder Power-Interest Quadrants**.
* **Interactive Spotlight & Inspector:** Zoom, pan, and hover over data points to inspect comment text, sentiment, row index, and organization metadata in real time.

### 🏛️ 3. Stakeholder Power-Interest Matrix & Strategic Mapping
* **2x2 Stakeholder Classification:** Classify stakeholder organizations along **Influence (Power)** and **Interest** axes (1.0 to 5.0 scale).
* **Four Strategic Quadrants:**
  * 🔴 **Key Players** (*High Power, High Interest*) – **2.5x Priority Weight**
  * 🟡 **Keep Satisfied** (*High Power, Low Interest*) – **1.8x Priority Weight**
  * 🔵 **Keep Informed** (*Low Power, High Interest*) – **1.2x Priority Weight**
  * ⚪ **Monitor** (*Low Power, Low Interest*) – **0.8x Priority Weight**
* **Automated Batch Heuristics:** Automatically discover organizations across the dataset and apply initial quadrant classifications.
* **Priority-Weighted Synthesis:** Incorporates stakeholder priority weights directly into AI synthesis prompts, ensuring Key Player concerns are front-and-center in executive reports.

### 🏷️ 4. Dynamic Topic Clustering & Custom Topic Manager
* **Automatic & Algorithmic Clustering:** Group feedback by semantic themes using vector distance algorithms and LLM analysis.
* **Custom Cluster Workbench:** Create custom topic tags, reclassify individual or batched comments, merge related themes, rename topics, or delete obsolete categories.
* **Export Custom Taxonomies:** Download refined, re-clustered feedback datasets with updated topic metadata in CSV or JSON formats.

### 🔍 5. Semantic Query Engine
* **Natural Language Vector Search:** Input any natural language query statement (e.g., *"usability friction during checkout"* or *"transit route delay complaints"*).
* **Cosine Similarity Evaluator:** Calculates angular similarity between the search vector and all dataset record vectors.
* **Adjustable Threshold Cutoff:** Use the precision slider (10% to 95% similarity match) to filter and highlight matching records instantly.

### 🛡️ 6. AI-Powered Deduplication Audit
* **Pairwise Vector Matrix Scanner:** Scans datasets for duplicate, near-identical, or redundant feedback entries using cosine similarity metrics.
* **Performance Safeguards:** Automatically caps pairwise deduplication checks at **1,500 records** to prevent CPU bottlenecks on large datasets while retaining full spatial visualization for all points.
* **Audit & Merge Actions:** Inspect duplicate clusters, select primary entries, archive redundant records, and export clean, deduplicated datasets or audit logs.

### 📊 7. Executive Synthesis & AI Report Writer
* **Stakeholder-Prioritized Reports:** Generates structured Markdown executive reports that highlight critical feedback from top-tier Key Players.
* **Structured Output:**
  1. **Executive Summary** (Overall mood & core takeaways)
  2. **Key Player & High-Power Stakeholder Priorities** (Targeted feedback from critical organizations)
  3. **Top Recurring Issues & Common Themes** (Key friction points and positive request clusters)
  4. **Strategic Action Plan** (Actionable bullet points prioritized by stakeholder impact)
  5. **Traceability Section** (Direct row index citations linking conclusions back to original CSV records)
* **Synthesis History:** Save, review, copy, or download generated reports at any time.

### 🗄️ 8. Flexible LLM & Local Vector Embedding Integration
* **Dual Embedding Modes:**
  * **Built-in Heuristics:** High-speed pseudo-embedding engine for instant testing without external dependencies or API keys.
  * **Local Custom LLM Proxy:** Integrates with local embedding models (*Ollama, LM Studio, Llama.cpp, OpenAI-compatible APIs*) via the backend CORS proxy (`/api/proxy-llm`).
* **Storage Optimization:** Automatically strips raw floating-point arrays before saving to `localStorage` to prevent browser quota exceptions, while auto-downloading complete `final_session_dataset_complete.json` files containing full high-dimensional vectors for offline reuse.

---

## 🏗️ Technical Architecture

* **Frontend:** React 19 (TypeScript), Vite, Tailwind CSS (v4), Motion (layout animations), Lucide React (iconography).
* **Backend:** Express (port 3000) acting as a static asset server and a backend CORS-bypassing proxy for local LLM and embedding endpoints.
* **Build System:** Compiled via `esbuild` into a bundled CommonJS output (`dist/server.cjs`) for clean Node runtime execution.

---

## ⚙️ Local Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher)
* **npm** (v9 or higher)
* *(Optional)* A local LLM/embedding server (e.g., **Ollama**, **LM Studio**, or an OpenAI-compatible server).

### 1. Clone & Navigate
```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory if needed:
```env
PORT=3000
NODE_ENV=development
```

### 4. Run Development Server
```bash
npm run dev
```
Access the application at `http://localhost:3000`.

### 5. Production Build & Execution
```bash
# Compile static assets & server bundle
npm run build

# Start production server
npm run start
```

---

## 🛠️ Connecting a Local LLM Server (Ollama Example)

To use local vector embeddings and completions:

1. **Start Ollama** with an embedding model (e.g., `nomic-embed-text`):
   ```bash
   ollama run nomic-embed-text
   ```
2. **Open Settings / Manage Datasets** in the application.
3. Toggle **Use Custom LLM / Embedding Server**.
4. Configure endpoints:
   * **Embedding Endpoint:** `http://localhost:11434/api/embeddings`
   * **Embedding Model:** `nomic-embed-text`
   * **LLM Completion Endpoint:** `http://localhost:11434/api/generate` (or `/v1/chat/completions`)
5. Import your dataset. Vector calculations and synthesis reports will route directly through your local LLM server!

