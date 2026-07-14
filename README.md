# Vector-Based Feedback Explorer & Similarity Query Engine

A powerful, high-performance, full-stack visual analytics tool designed to ingest customer comments, support tickets, or feedback CSV datasets, process them via text-embedding models, and perform interactive cluster analysis. 

Built with a fast **Express + Vite + React (TypeScript)** architecture, it features offline-first processing, client-side vector calculations, semantic searching, and AI-powered duplication reviews.

---

## 🚀 Key Capabilities

### 📍 1. Interactive 2D Similarity Plot
* **High-Dimensional Projections:** Visualizes feedback comments in a responsive 2D coordinate system.
* **Intelligent Color Mapping:** Instantly colorize comments by **Sentiment** (Positive/Neutral/Negative) or **Topic** clusters.
* **Map Tracking & Spotlighting:** Select any data point on the canvas to highlight relative details and pinpoint specific records.

### 🔍 2. Semantic Query Engine
* **Natural Language Vector Search:** Write a custom search statement (e.g., *"performance lag during checkout"*) to generate a vector on-the-fly.
* **Cosine Similarity Evaluator:** Ranks and filters records matching your search statement based on high-dimensional angular similarity.
* **Adjustable Cutoff Thresholds:** Slide the similarity match threshold from Broad (10%) to Strict (95%) to fine-tune results.

### 🛡️ 3. AI-Powered Deduplication Audit
* **Intelligent Grouping:** Scans your dataset for redundant, overlapping, or identical feedback entries using pairwise cosine similarity metrics.
* **Performance Safeguards:** Automatically caps similarity deduplication checks at **1,500 records** to prevent CPU lockups on massive datasets, while preserving full visual exploratory analytics for the entire dataset.
* **Merge & Archive Actions:** Consolidate redundant comments to keep datasets clean.

### 📊 4. Executive Summary Writer & Synthesis
* **Structural Outline Generator:** Prompts an LLM (such as local models or Gemini) to craft concise, executive-ready syntheses of feedback trends and key actionable insights.

### 🗄️ 5. Dataset Configuration & Local LLM Integration
* **Double Embedding Modes:**
  * **Built-in Heuristics:** Employs deterministic, high-speed unit-length pseudo-embeddings for instant testing without APIs.
  * **Local Custom Embeddings:** Integrates with local embedding models (Ollama, HuggingFace, OpenAI-compatible APIs) via a backend CORS proxy route.
* **Local Storage Safety:** To prevent browser crashes and `QuotaExceededError` messages, the app strips raw, multi-dimensional floating-point arrays (`embedding` property) before syncing data to `localStorage`.
* **Automatic JSON Exports:** When an embedding batch concludes, the app automatically prepares and downloads a complete `final_session_dataset_complete.json` file containing all high-dimensional vectors for offline use.

---

## 🏗️ Technical Architecture

* **Frontend:** React 19 (TypeScript), Vite, Tailwind CSS (v4), Motion (for layout transitions), Lucide React (for iconography).
* **Backend:** Express (port 3000) serves both as the asset server and a backend CORS-bypassing proxy for local LLM servers.
* **Build System:** Bundled via `esbuild` into a self-contained CommonJS output (`dist/server.cjs`) to guarantee smooth Node runtime resolution.

---

## ⚙️ Local Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** (v9 or higher)
* *(Optional)* A local LLM server running, such as **Ollama**, **Llama.cpp**, or an OpenAI-compatible proxy.

### 1. Clone & Navigate
```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Dependencies
Install all backend and frontend packages defined in `package.json`:
```bash
npm install
```

### 3. Environment Setup
The development server will read environment variables. Create a `.env` file in the root directory if you want to configure specific ports or backend secrets:
```bash
# .env
PORT=3000
NODE_ENV=development
```

### 4. Running the Development Server
Execute the launch script:
```bash
npm run dev
```
The server will boot and bind to `http://localhost:3000`. You can open this address in your browser to interact with the application.

### 5. Production Compilation & Launch
To bundle and build the production-ready code:
```bash
# Compile static assets & backend bundle
npm run build

# Start the optimized Node server
npm run start
```

---

## 🛠️ Connecting a Local LLM (Ollama, etc.)

To run high-dimensional vector embeddings locally (e.g., mapping text directly to actual float arrays):

1. **Launch your local server.** For instance, with Ollama, run:
   ```bash
   ollama run nomic-embed-text
   ```
2. **Navigate to "Manage Datasets"** in the app.
3. Under **Local LLM & Embedding Settings**, toggle **Use Custom LLM / Embedding Server**.
4. Configure the following values:
   * **Embedding API Endpoint:** `http://localhost:11434/api/embeddings` (for Ollama) or your custom proxy.
   * **Embedding Model Name:** `nomic-embed-text` (or your preferred local vector model).
   * **JSON Path to Vector:** (Specify how the vector is returned, or leave blank to use the app's adaptive auto-parser).
5. Load a dataset CSV and click **Start Vector Indexing**. Once complete, the processed dataset with raw embeddings will automatically trigger a complete JSON download for offline saving!
