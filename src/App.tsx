import { useState, useEffect, useMemo } from "react";
import { CommentItem, FilterState, LlmSettings } from "./types";
import { generateDefaultDataset } from "./data/defaultComments";
import { clusterCommentsDynamically } from "./utils/topicClustering";
import { VectorPlot } from "./components/VectorPlot";
import { DashboardStats } from "./components/DashboardStats";
import { DuplicateReview, calculateCosineSimilarity } from "./components/DuplicateReview";
import { ExecutiveReport } from "./components/ExecutiveReport";
import { ImportExport } from "./components/ImportExport";
import { SetupLandingPage } from "./components/SetupLandingPage";
import { SemanticQuery } from "./components/SemanticQuery";
import { getCachedEmbedding, loadEmbeddingsIntoCache, setCachedEmbedding, getCommentEmbedding } from "./utils/embeddingsCache";
import { 
  fetchLocalEmbeddings, 
  fetchLocalCompletion, 
  generateLocalHeuristicSummary, 
  getDeterministicPseudoEmbedding,
  testLlmConnection
} from "./utils/localLlm";
import { 
  Sparkles, 
  Map, 
  ShieldCheck, 
  Layers, 
  Database, 
  Search, 
  Trash2, 
  RefreshCcw, 
  PlusCircle, 
  Calendar,
  Sparkle,
  Info,
  CheckCircle,
  Clock,
  Settings,
  X,
  LogOut,
  Server,
  Loader2
} from "lucide-react";

export default function App() {
  // 1. Initial State Definition
  const [comments, setCommentsInternal] = useState<CommentItem[]>(() => {
    const saved = localStorage.getItem("workspace_comments");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return []; // Empty by default so it forces the landing/setup page
  });

  const setComments = (newComments: CommentItem[] | ((prev: CommentItem[]) => CommentItem[])) => {
    if (typeof newComments === "function") {
      setCommentsInternal((prev) => {
        const resolved = newComments(prev);
        loadEmbeddingsIntoCache(resolved);
        return resolved.map(({ embedding, ...rest }) => rest as CommentItem);
      });
    } else {
      loadEmbeddingsIntoCache(newComments);
      setCommentsInternal(newComments.map(({ embedding, ...rest }) => rest as CommentItem));
    }
  };

  const [isInitialized, setIsInitialized] = useState<boolean>(comments.length > 0);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'explore' | 'duplicates' | 'report' | 'data' | 'query'>('explore');
  const [colorMode, setColorMode] = useState<'sentiment' | 'topic'>('sentiment');
  
  // Local LLM Settings
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() => {
    const saved = localStorage.getItem("llm_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      baseUrl: "http://localhost:11434/v1",
      modelName: "llama3",
      embeddingUrl: "http://localhost:11434/v1",
      embeddingModel: "nomic-embed-text",
      apiKey: "",
      useCustomEmbedding: false
    };
  });

  // Settings Slide-over visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Local discovered models list states
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    const saved = localStorage.getItem("workspace_available_models");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["llama3", "llama3.2", "mistral", "gemma2", "phi3", "qwen2.5"];
  });

  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState<string[]>(() => {
    const saved = localStorage.getItem("workspace_available_embedding_models");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["nomic-embed-text", "all-minilm", "bge-large", "mxbai-embed-large"];
  });

  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);

  const handleTestConnection = async (settingsToTest?: LlmSettings) => {
    const activeSettings = settingsToTest || llmSettings;
    setIsTestingConnection(true);
    showToast("Testing local LLM server connection...", "info");
    try {
      const res = await testLlmConnection(activeSettings);
      if (res.success) {
        showToast(res.message, "success");
        if (res.models && res.models.length > 0) {
          setAvailableModels(res.models);
          setAvailableEmbeddingModels(res.models);
          
          // Auto select if currently configured names are not in the list
          const updatedSettings = { ...activeSettings };
          let changed = false;
          if (!res.models.includes(activeSettings.modelName)) {
            updatedSettings.modelName = res.models[0];
            changed = true;
          }
          if (activeSettings.useCustomEmbedding && !res.models.includes(activeSettings.embeddingModel)) {
            updatedSettings.embeddingModel = res.models[0];
            changed = true;
          }
          if (changed) {
            setLlmSettings(updatedSettings);
          }
        }
      }
    } catch (err: any) {
      showToast(err.message || "Connection test failed.", "error");
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Real-time notification banners
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Applet status flags
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [indexingProgress, setIndexingProgress] = useState<number>(0);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(() => {
    return localStorage.getItem("executive_summary") || null;
  });

  const closeSettings = () => {
    setIsSettingsOpen(false);
    setShowClearConfirm(false);
  };

  // Filter structure
  const [filters, setFilters] = useState<FilterState>({
    sentiments: [],
    topics: [],
    searchQuery: "",
    showDuplicatesOnly: false,
    similarityThreshold: 0.85,
  });

  // Sync state helpers
  useEffect(() => {
    try {
      // To prevent QuotaExceededError and massive performance/storage issues,
      // we strip the raw, high-dimensional float arrays (embedding property) from the comments
      // list stored in localStorage. All other metadata (x, y, sentiment, topic) are fully preserved.
      // This reduces storage size by ~99% and ensures it stays well under the 5MB browser quota.
      const lightweightComments = comments.map(({ embedding, ...rest }) => rest);
      localStorage.setItem("workspace_comments", JSON.stringify(lightweightComments));
    } catch (err) {
      console.warn("Could not save lightweight comments to localStorage (quota limit exceeded or storage blocked):", err);
    }
    setIsInitialized(comments.length > 0);
  }, [comments]);

  // Load/Generate embeddings for comments in cache if they don't exist
  useEffect(() => {
    if (comments.length > 0) {
      for (const c of comments) {
        if (!getCachedEmbedding(c.id)) {
          if (c.embedding && c.embedding.length > 0) {
            setCachedEmbedding(c.id, c.embedding);
          } else if (!llmSettings.useCustomEmbedding) {
            setCachedEmbedding(c.id, getDeterministicPseudoEmbedding(c.text));
          }
        }
      }
    }
  }, [comments, llmSettings.useCustomEmbedding]);

  useEffect(() => {
    localStorage.setItem("llm_settings", JSON.stringify(llmSettings));
  }, [llmSettings]);

  useEffect(() => {
    localStorage.setItem("workspace_available_models", JSON.stringify(availableModels));
  }, [availableModels]);

  useEffect(() => {
    localStorage.setItem("workspace_available_embedding_models", JSON.stringify(availableEmbeddingModels));
  }, [availableEmbeddingModels]);

  useEffect(() => {
    if (executiveSummary) {
      localStorage.setItem("executive_summary", executiveSummary);
    } else {
      localStorage.removeItem("executive_summary");
    }
  }, [executiveSummary]);

  // Simple toast trigger
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 3. Filter Comments
  const filteredComments = useMemo(() => {
    return comments.filter((item) => {
      // Always include user query node to keep it visible on the map
      if (item.id === "user_query_node") return true;

      // Skip archived
      if (item.isArchived) return false;

      // Filter by duplicates setting
      if (filters.showDuplicatesOnly && !item.isDuplicate) return false;

      // Filter by Sentiment list
      if (filters.sentiments.length > 0 && !filters.sentiments.includes(item.sentiment)) return false;

      // Filter by Topic cluster list
      if (filters.topics.length > 0 && !filters.topics.includes(item.topic)) return false;

      // Filter by Search text query (case-insensitive)
      if (filters.searchQuery.trim().length > 0) {
        const query = filters.searchQuery.toLowerCase();
        const matchesText = item.text.toLowerCase().includes(query);
        const matchesTopic = item.topic.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query);
        if (!matchesText && !matchesTopic && !matchesId) return false;
      }

      return true;
    });
  }, [comments, filters]);

  // Selected Comment record
  const selectedComment = useMemo(() => {
    if (!selectedCommentId) return null;
    return comments.find((c) => c.id === selectedCommentId && !c.isArchived) || null;
  }, [comments, selectedCommentId]);

  // Similar items to the currently selected comment
  const similarToSelected = useMemo(() => {
    if (!selectedComment) return [];
    const selectedEmbedding = getCommentEmbedding(selectedComment, llmSettings.useCustomEmbedding);
    if (!selectedEmbedding || selectedEmbedding.length === 0) return [];
    
    return comments
      .filter((c) => c.id !== selectedComment.id && !c.isArchived)
      .map((c) => {
        const cEmbedding = getCommentEmbedding(c, llmSettings.useCustomEmbedding);
        const similarity = cEmbedding ? calculateCosineSimilarity(selectedEmbedding, cEmbedding) : 0;
        return { comment: c, similarity };
      })
      .filter((res) => res.similarity >= 0.5) // Only display matches with 50%+ similarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // top 5 matches
  }, [comments, selectedComment, llmSettings.useCustomEmbedding]);

  // 4. API Event: Indexing raw CSV comments
  const handleStartIndexing = async (
    texts: string[],
    onProgress?: (completedCount: number, currentEmbeddings: number[][]) => void
  ): Promise<number[][]> => {
    setIsIndexing(true);
    setIndexingProgress(0);
    showToast(
      llmSettings.useCustomEmbedding 
        ? `Requesting embeddings row-by-row from ${llmSettings.embeddingModel} on local server...` 
        : "Generating client-side heuristic embeddings row-by-row...",
      "info"
    );

    const embeddings: number[][] = [];
    try {
      for (let i = 0; i < texts.length; i++) {
        let vector: number[] = [];
        const text = texts[i];
        
        if (llmSettings.useCustomEmbedding) {
          try {
            // Process each row separately as a call to the embedding LLM
            const singleEmbeddingArray = await fetchLocalEmbeddings([text], llmSettings);
            vector = singleEmbeddingArray[0] || getDeterministicPseudoEmbedding(text);
          } catch (err) {
            console.warn(`Row ${i + 1} local embedding fetch failed. Using deterministic heuristic fallback.`, err);
            vector = getDeterministicPseudoEmbedding(text);
          }
        } else {
          // Heuristic embedding
          vector = getDeterministicPseudoEmbedding(text);
          // Add a tiny artificial delay to simulate real-time processing and display progress cleanly
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        embeddings.push(vector);

        const currentCount = i + 1;
        const progressPercent = Math.round((currentCount / texts.length) * 100);
        setIndexingProgress(progressPercent);

        if (onProgress) {
          try {
            onProgress(currentCount, embeddings);
          } catch (cbErr) {
            console.error("Error in onProgress callback during indexing auto-backup:", cbErr);
          }
        }
      }

      setIndexingProgress(100);
      setIsIndexing(false);
      showToast("Embeddings successfully mapped and indexed row-by-row!", "success");
      return embeddings;
    } catch (err: any) {
      console.warn("Indexing failed.", err);
      setIndexingProgress(100);
      setIsIndexing(false);
      showToast("Error during dataset indexing.", "error");
      // Fallback
      return texts.map(t => getDeterministicPseudoEmbedding(t));
    }
  };

  // 5. API Event: Generate Summary
  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    showToast(`Requesting summary from local chat model: ${llmSettings.modelName}...`, "info");

    try {
      let summaryText = "";
      
      const structuredPrompt = `You are a Principal Customer Experience & Data Analyst.
Analyze the following stakeholder comments collected from an update or product release.
Provide an executive synthesis summarizing stakeholder sentiment, core themes, recurring pain points, and action items.

Comments Dataset:
${filteredComments.slice(0, 80).map((c, i) => `[Comment ${i+1}] Topic: "${c.topic}", Sentiment: "${c.sentiment}"\nText: "${c.text}"`).join("\n---\n")}

Format the response using beautiful, professional Markdown including:
1. **Executive Summary**: A concise paragraph of the overall stakeholder mood.
2. **Top Recurring Issues**: Key complaints/bugs requiring immediate attention.
3. **Core Common Themes**: Primary positive or request clusters.
4. **Strategic Action Plan**: 3 clear bullet points on how to resolve the issues.`;

      try {
        summaryText = await fetchLocalCompletion(structuredPrompt, llmSettings);
        showToast("Local LLM report synthesis complete!", "success");
      } catch (innerErr: any) {
        console.warn("Local model connection failed. Creating tailored heuristic report.", innerErr);
        showToast("Local server offline/CORS blocked. Compiled dynamic analysis.", "info");
        summaryText = generateLocalHeuristicSummary(filteredComments);
      }

      setExecutiveSummary(summaryText);
      setIsSummarizing(false);
    } catch (err: any) {
      setIsSummarizing(false);
      showToast(err.message || "Report generation failed.", "error");
    }
  };

  // 6. Action: Add a manual single comment
  const [newCommentText, setNewCommentText] = useState("");
  const handleAddManualComment = () => {
    if (!newCommentText.trim()) return;

    // Generate coordinates on outer borders
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.5 + Math.random() * 0.4;
    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius;

    // Fast deterministic vector
    const vector = new Array(256).fill(0).map((_, i) => Math.sin(i * newCommentText.length));

    const newRec: CommentItem = {
      id: `man_${Date.now().toString().slice(-4)}`,
      text: newCommentText.trim(),
      sentiment: "neutral",
      topic: "Unassigned Feedback",
      embedding: vector,
      x,
      y,
      isArchived: false,
      timestamp: new Date().toISOString().split('T')[0]
    };

    setComments((prev) => [...prev, newRec]);
    setNewCommentText("");
    setSelectedCommentId(newRec.id);
    showToast("Added manual comment. Click it on the map to label or categorize!", "success");
  };

  // 7. Action: Update metadata details on selected comment
  const handleUpdateSelectedMetadata = (fields: Partial<CommentItem>) => {
    setComments((prev) =>
      prev.map((c) => (c.id === selectedCommentId ? { ...c, ...fields } : c))
    );
    showToast("Updated item properties", "success");
  };

  // 8. Action: Archive / Remove duplicate or comment
  const handleArchiveComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isArchived: true } : c))
    );
    if (selectedCommentId === id) {
      setSelectedCommentId(null);
    }
    showToast("Comment archived successfully.", "success");
  };

  // 9. Action: Dismiss Duplicate status (Keep both)
  const handleDismissDuplicate = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isDuplicate: false, duplicateOfId: undefined } : c))
    );
    showToast("Marked as unique.", "success");
  };

  // 10. Session Operations: Export & Import JSON
  const handleExportSession = () => {
    const fullComments = comments.map((c) => ({
      ...c,
      embedding: getCommentEmbedding(c, llmSettings.useCustomEmbedding) || c.embedding,
    }));
    const sessionData = {
      comments: fullComments,
      similarityThreshold: filters.similarityThreshold,
      executiveSummary,
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `similarity_session_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Session JSON file exported successfully!", "success");
  };

  const handleImportSession = (sessionData: {
    comments: CommentItem[];
    similarityThreshold: number;
    executiveSummary: string | null;
  }) => {
    setComments(sessionData.comments);
    setFilters((prev) => ({ ...prev, similarityThreshold: sessionData.similarityThreshold }));
    setExecutiveSummary(sessionData.executiveSummary);
    setSelectedCommentId(null);
    showToast("Session state successfully restored!", "success");
  };

  const handleImportCSV = (newComments: CommentItem[]) => {
    setComments(newComments);
    setSelectedCommentId(null);
    setExecutiveSummary(null); // Clear summary for new dataset
    showToast(`Loaded ${newComments.length} comments from CSV dataset!`, "success");
  };

  const handleReclusterTopics = () => {
    if (comments.length === 0) {
      showToast("No active comments found to analyze.", "error");
      return;
    }
    const updated = clusterCommentsDynamically(comments);
    setComments(updated);
    setFilters((prev) => ({ ...prev, topics: [] })); // Clear selected topics since they are updated
    showToast("Successfully identified and clustered authentic topics from comments!", "success");
  };

  const handleReloadProjectionWithQuery = (queryText: string, queryEmbedding: number[]) => {
    if (comments.length === 0) {
      showToast("No active comments found to project.", "error");
      return;
    }

    // Filter out previous user query node
    const otherComments = comments.filter((c) => c.id !== "user_query_node");

    // Compute coordinates using the standard projection logic
    let qX = 0;
    let qY = 0;
    if (queryEmbedding && queryEmbedding.length >= 2) {
      const half = Math.floor(queryEmbedding.length / 2);
      const sumA = queryEmbedding.slice(0, half).reduce((sum, v) => sum + v, 0);
      const sumB = queryEmbedding.slice(half).reduce((sum, v) => sum + v, 0);
      qX = Math.sin(sumA * 4.5) * 0.95;
      qY = Math.cos(sumB * 4.5) * 0.95;
    }

    const queryNode: CommentItem = {
      id: "user_query_node",
      text: queryText,
      sentiment: "neutral",
      topic: "🔍 Search Query",
      embedding: queryEmbedding,
      x: qX,
      y: qY,
      isArchived: false,
      timestamp: new Date().toISOString().split('T')[0]
    };

    const allItemsToProject = [...otherComments, queryNode];

    // Re-calculate coordinates for all items (re-project them all)
    const updated = allItemsToProject.map((item, idx) => {
      const vector = getCommentEmbedding(item, llmSettings.useCustomEmbedding) || item.embedding || [];
      
      let x = 0;
      let y = 0;
      
      if (vector && vector.length >= 2) {
        const half = Math.floor(vector.length / 2);
        const sumA = vector.slice(0, half).reduce((sum, v) => sum + v, 0);
        const sumB = vector.slice(half).reduce((sum, v) => sum + v, 0);
        x = Math.sin(sumA * 4.5) * 0.95;
        y = Math.cos(sumB * 4.5) * 0.95;
      } else {
        x = Math.sin(idx * 0.4) * 0.8;
        y = Math.cos(idx * 0.4) * 0.8;
      }

      return {
        ...item,
        x,
        y
      };
    });

    setComments(updated);
    setSelectedCommentId("user_query_node");
    showToast("Re-computed coordinates & placed query node in the visual cluster!", "success");
  };

  const handleClearQueryNode = () => {
    setComments((prev) => prev.filter((c) => c.id !== "user_query_node"));
    if (selectedCommentId === "user_query_node") {
      setSelectedCommentId(null);
    }
    showToast("Removed search query node from the visual cluster.", "info");
  };

  const apiMode = llmSettings.useCustomEmbedding ? "live" : "demo";

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#E5E3DF]">
      
      {/* Dynamic Toast System */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-5 py-3 shadow-sm flex items-center gap-3 border text-xs tracking-wide font-medium rounded-none bg-white ${
            toast.type === "success" 
              ? "border-[#4A6741] text-[#4A6741]" 
              : toast.type === "error"
              ? "border-[#A13D2D] text-[#A13D2D]"
              : "border-[#1A1A1A] text-[#1A1A1A]"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              toast.type === "success" 
                ? "bg-[#4A6741]" 
                : toast.type === "error"
                ? "bg-[#A13D2D]"
                : "bg-[#1A1A1A]"
            }`} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Slide-over Settings Drawer */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#1A1A1A]/30 backdrop-blur-xs transition-opacity duration-300"
            onClick={closeSettings}
          />

          <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
            <div className="w-screen max-w-md bg-white border-l border-[#E5E3DF] p-6 flex flex-col justify-between shadow-xl animate-in slide-in-from-right duration-300">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E5E3DF]">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#1A1A1A]" />
                    <h3 className="font-serif italic text-lg text-[#1A1A1A]">Local LLM Configuration</h3>
                  </div>
                  <button 
                    onClick={closeSettings}
                    className="p-1 text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="space-y-5 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                      Local LLM API Base URL
                    </label>
                    <input
                      type="text"
                      value={llmSettings.baseUrl}
                      onChange={(e) => setLlmSettings({ ...llmSettings, baseUrl: e.target.value })}
                      placeholder="http://localhost:11434/v1"
                      className="w-full bg-white border border-[#E5E3DF] px-3 py-2 text-xs focus:outline-none focus:border-[#1A1A1A] font-mono rounded-none mb-2"
                    />
                    <button
                      type="button"
                      disabled={isTestingConnection}
                      onClick={() => handleTestConnection()}
                      className="w-full py-1.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 disabled:bg-gray-300 text-white text-[9px] uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCcw className={`w-3 h-3 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      {isTestingConnection ? "Testing & Fetching Models..." : "Test Connection & Fetch Models"}
                    </button>
                    <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider leading-relaxed">
                      OpenAI-compatible local server (Ollama, LM Studio, etc.)
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                      Synthesis Chat Model Name
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={availableModels.includes(llmSettings.modelName) ? llmSettings.modelName : ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setLlmSettings({ ...llmSettings, modelName: e.target.value });
                          }
                        }}
                        className="flex-1 bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] rounded-none"
                      >
                        <option value="" disabled>-- Select retrieved model --</option>
                        {availableModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={llmSettings.modelName}
                        onChange={(e) => setLlmSettings({ ...llmSettings, modelName: e.target.value })}
                        placeholder="llama3"
                        className="w-1/3 bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] font-mono rounded-none"
                        title="Manual model override"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-[#E5E3DF] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700">Custom Local Embeddings Endpoint</span>
                      <input
                        type="checkbox"
                        checked={llmSettings.useCustomEmbedding}
                        onChange={(e) => setLlmSettings({ ...llmSettings, useCustomEmbedding: e.target.checked })}
                        className="w-4 h-4 accent-[#1A1A1A] cursor-pointer"
                      />
                    </div>

                    {llmSettings.useCustomEmbedding ? (
                      <div className="space-y-3 p-3 bg-[#F9F8F6] border border-[#E5E3DF] animate-in fade-in duration-200">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                            Embedding Endpoint Base URL
                          </label>
                          <input
                            type="text"
                            value={llmSettings.embeddingUrl}
                            onChange={(e) => setLlmSettings({ ...llmSettings, embeddingUrl: e.target.value })}
                            placeholder="http://localhost:11434/v1"
                            className="w-full bg-white border border-[#E5E3DF] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] font-mono rounded-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                            Embedding Model Name
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={availableEmbeddingModels.includes(llmSettings.embeddingModel) ? llmSettings.embeddingModel : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setLlmSettings({ ...llmSettings, embeddingModel: e.target.value });
                                }
                              }}
                              className="flex-1 bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] rounded-none"
                            >
                              <option value="" disabled>-- Select retrieved model --</option>
                              {availableEmbeddingModels.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={llmSettings.embeddingModel}
                              onChange={(e) => setLlmSettings({ ...llmSettings, embeddingModel: e.target.value })}
                              placeholder="nomic-embed-text"
                              className="w-1/3 bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] font-mono rounded-none"
                              title="Manual embedding model override"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 p-3 bg-[#4A6741]/5 border border-[#4A6741]/20 text-[#4A6741]">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p className="text-[9px] leading-normal">
                          Using built-in local heuristics. Snappy, client-side, and 100% offline.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E5E3DF]">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                      Bearer Authorization Key (Optional)
                    </label>
                    <input
                      type="password"
                      value={llmSettings.apiKey}
                      onChange={(e) => setLlmSettings({ ...llmSettings, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-white border border-[#E5E3DF] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] font-mono rounded-none"
                    />
                  </div>
                </div>
              </div>

              {/* Reset/Clear Button inside the settings tray */}
              <div className="pt-4 border-t border-[#E5E3DF] space-y-3">
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full py-2.5 bg-[#A13D2D] hover:bg-[#A13D2D]/90 text-white text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Clear Workspace & Exit
                  </button>
                ) : (
                  <div className="bg-[#A13D2D]/5 p-3.5 border border-[#A13D2D]/20 space-y-3 animate-in fade-in duration-200">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#A13D2D] text-center">
                      Confirm Clear Workspace?
                    </p>
                    <p className="text-[9px] text-gray-500 text-center leading-normal">
                      This will erase all active comments and executive summaries. Your local LLM configuration is kept intact.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-1.5 border border-[#E5E3DF] hover:border-[#1A1A1A] text-[#1A1A1A] bg-white text-[9px] uppercase tracking-wider font-bold cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setComments([]);
                          setExecutiveSummary(null);
                          setSelectedCommentId(null);
                          setShowClearConfirm(false);
                          setIsSettingsOpen(false);
                          showToast("Workspace successfully reset.", "info");
                        }}
                        className="flex-1 py-1.5 bg-[#A13D2D] hover:bg-[#A13D2D]/90 text-white text-[9px] uppercase tracking-wider font-bold cursor-pointer transition-colors"
                      >
                        Yes, Clear
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={closeSettings}
                  className="w-full py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-[10px] uppercase tracking-widest font-bold flex items-center justify-center cursor-pointer transition-all"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Header navigation */}
      <header id="main_header" className="bg-white border-b border-[#E5E3DF] h-16 flex items-center justify-between px-8 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <span className="font-serif italic text-2xl tracking-tighter text-[#1A1A1A]">Sentiment.Core</span>
          <span className="h-4 w-px bg-[#E5E3DF]"></span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">Vector Intelligence Hub</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Local LLM Info Label */}
          <div className="hidden md:flex items-center gap-2 border border-[#E5E3DF] bg-[#F9F8F6] px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono">
            <span className={`h-1.5 w-1.5 rounded-full ${llmSettings.useCustomEmbedding ? "bg-[#4A6741] animate-pulse" : "bg-gray-400"}`} />
            <span className="text-gray-500">LLM:</span>
            <span className="font-bold text-[#1A1A1A]">{llmSettings.modelName}</span>
          </div>

          {/* Quick stats label (only if initialized) */}
          {isInitialized && (
            <div className="border border-[#E5E3DF] text-[#1A1A1A] px-3 py-1.5 text-[10px] uppercase tracking-widest font-mono font-bold bg-white">
              {comments.filter(c => !c.isArchived).length} records
            </div>
          )}

          {/* Slide Drawer Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 border border-[#1A1A1A] hover:bg-[#F9F8F6] text-[#1A1A1A] px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-all bg-white"
            title="Configure Local LLM"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Conditional Rendering Content */}
      {!isInitialized ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <SetupLandingPage
            llmSettings={llmSettings}
            onChangeSettings={setLlmSettings}
            onInitializeWithComments={(newComments, summary) => {
              setComments(newComments);
              if (summary) setExecutiveSummary(summary);
            }}
            onStartIndexing={handleStartIndexing}
            isIndexing={isIndexing}
            availableModels={availableModels}
            availableEmbeddingModels={availableEmbeddingModels}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
          />
        </div>
      ) : (
        <>
          {/* Heuristics notification banner */}
          {!llmSettings.useCustomEmbedding && (
            <div className="bg-[#1A1A1A] text-white py-3 px-8 border-b border-[#E5E3DF]">
              <div className="max-w-7xl mx-auto flex items-center gap-3 text-xs tracking-wide">
                <Info className="w-4 h-4 text-gray-300 shrink-0" />
                <span>
                  <strong className="font-semibold">LOCAL HEURISTIC PROJECTIONS ACTIVE:</strong> Generate embeddings and synthesis directly inside the browser instantly. Open <strong>Settings</strong> to configure a local model endpoint (Ollama, LM Studio).
                </span>
              </div>
            </div>
          )}

          {/* Main body viewport */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
            
            {/* Dynamic Interactive Metrics Dashboard Row */}
            <section id="metrics_dashboard">
              <DashboardStats 
                comments={comments} 
                filters={filters} 
                onChangeFilters={setFilters} 
                onClearFilters={() => setFilters({
                  sentiments: [],
                  topics: [],
                  searchQuery: "",
                  showDuplicatesOnly: false,
                  similarityThreshold: filters.similarityThreshold,
                })}
                isFallback={apiMode === "demo"}
                onReclusterTopics={handleReclusterTopics}
              />
            </section>

            {/* View Mode Navigation Tabs */}
            <section className="flex border-b border-[#E5E3DF] w-full overflow-x-auto shrink-0 scrollbar-none">
              {[
                { id: "explore", label: "Similarity Plot", icon: Map },
                { id: "duplicates", label: "Deduplication Audit", icon: ShieldCheck },
                { id: "query", label: "Semantic Query", icon: Sparkle },
                { id: "report", label: "Executive Synthesis", icon: Layers },
                { id: "data", label: "Manage Datasets", icon: Database },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center justify-center gap-2 px-6 py-3.5 text-[11px] uppercase tracking-[0.15em] font-semibold border-b-2 -mb-[2px] transition-all shrink-0 ${
                      isActive
                        ? "border-[#1A1A1A] text-[#1A1A1A]"
                        : "border-transparent text-gray-400 hover:text-[#1A1A1A]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </section>

            {/* Dynamic Display Panels */}
            <section className="transition-all duration-300">
              
              {/* TAB 1: VECTOR COORDINATE EXPLORATION SPACE */}
              {activeTab === "explore" && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  
                  {/* Interactive Plot */}
                  <div className="xl:col-span-2 h-[520px] flex flex-col">
                    <VectorPlot
                      comments={filteredComments}
                      selectedCommentId={selectedCommentId}
                      onSelectComment={(id) => setSelectedCommentId(id)}
                      colorMode={colorMode}
                      setColorMode={setColorMode}
                    />
                  </div>

                  {/* Sidebar filter list & Details inspection */}
                  <div className="xl:col-span-1 flex flex-col gap-6">
                    
                    {/* A. Search and List Filter controller */}
                    <div className="bg-white p-6 border border-[#E5E3DF] space-y-4 rounded-none shadow-none">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" /> Refine & Search
                      </h3>

                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                        <input
                          type="text"
                          placeholder="Search comments text, topic..."
                          value={filters.searchQuery}
                          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                          className="w-full bg-white border border-[#E5E3DF] pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-[#1A1A1A] rounded-none"
                        />
                      </div>

                      {/* Add manual comment */}
                      <div className="pt-3 border-t border-[#E5E3DF] flex gap-2">
                        <input
                          type="text"
                          placeholder="Add manual comment..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddManualComment()}
                          className="flex-1 bg-white border border-[#E5E3DF] px-3 py-2 text-xs focus:outline-none focus:border-[#1A1A1A] rounded-none"
                        />
                        <button
                          onClick={handleAddManualComment}
                          title="Add Comment"
                          className="p-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* B. Active Comment details or fallback instruction */}
                    {selectedComment ? (
                      <div className="bg-white p-6 border border-[#E5E3DF] space-y-4 animate-in fade-in duration-200 rounded-none">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-[#F9F8F6] text-[#1A1A1A] font-semibold px-2 py-0.5 border border-[#E5E3DF] font-mono">
                            {selectedComment.id}
                          </span>
                          <button
                            onClick={() => handleArchiveComment(selectedComment.id)}
                            title="Archive Comment"
                            className="p-1.5 text-gray-400 hover:text-[#A13D2D] hover:bg-[#A13D2D]/5 rounded-none transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="bg-[#F9F8F6] p-4 border border-[#E5E3DF] max-h-36 overflow-y-auto rounded-none">
                          <p className="text-xs text-[#1A1A1A] leading-relaxed font-serif italic">
                            "{selectedComment.text}"
                          </p>
                        </div>

                        {/* Meta modifier selectors */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Sentiment</label>
                            <select
                              value={selectedComment.sentiment}
                              onChange={(e) => handleUpdateSelectedMetadata({ sentiment: e.target.value as any })}
                              className="w-full bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs rounded-none focus:outline-none focus:border-[#1A1A1A]"
                            >
                              <option value="positive">Positive</option>
                              <option value="neutral">Neutral</option>
                              <option value="negative">Negative</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Topic Cluster</label>
                            <select
                              value={selectedComment.topic}
                              onChange={(e) => handleUpdateSelectedMetadata({ topic: e.target.value })}
                              className="w-full bg-white border border-[#E5E3DF] px-2 py-1.5 text-xs rounded-none focus:outline-none focus:border-[#1A1A1A]"
                            >
                              <option value="Performance & Speed">Performance & Speed</option>
                              <option value="UI/UX & Layout">UI/UX & Layout</option>
                              <option value="Bugs & Crashes">Bugs & Crashes</option>
                              <option value="Pricing & Value">Pricing & Value</option>
                              <option value="Features & Requests">Features & Requests</option>
                              <option value="General Feedback">General Feedback</option>
                            </select>
                          </div>
                        </div>

                        {/* Vector Neighbors similarity display */}
                        {similarToSelected.length > 0 && (
                          <div className="pt-4 border-t border-[#E5E3DF]">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-[#1A1A1A]/60 block mb-2">
                              Nearest Semantic Neighbors
                            </span>
                            <div className="space-y-1">
                              {similarToSelected.map(({ comment, similarity }) => (
                                <button
                                  key={comment.id}
                                  onClick={() => setSelectedCommentId(comment.id)}
                                  className="w-full p-2 hover:bg-[#F9F8F6] border border-transparent hover:border-[#E5E3DF] text-left transition-colors flex items-center justify-between gap-3 text-xs rounded-none cursor-pointer"
                                >
                                  <p className="truncate font-medium text-gray-700 flex-1">
                                    "{comment.text}"
                                  </p>
                                  <span className="text-[10px] font-bold font-mono text-[#4A6741] bg-[#4A6741]/5 border border-[#4A6741]/20 px-1.5 py-0.5 rounded-none">
                                    {(similarity * 100).toFixed(0)}%
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white p-8 border border-[#E5E3DF] text-center flex flex-col items-center justify-center min-h-[220px] rounded-none shadow-none">
                        <div className="w-10 h-10 border border-[#E5E3DF] text-gray-400 rounded-none flex items-center justify-center mb-3">
                          <Clock className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">
                          No selection
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 max-w-[180px] leading-relaxed">
                          Click any coordinate point on the map to inspect neighbors.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: VECTOR DEDUPLICATION REVIEW TABLE */}
              {activeTab === "duplicates" && (
                <DuplicateReview
                  comments={comments}
                  similarityThreshold={filters.similarityThreshold}
                  onChangeThreshold={(val) => setFilters({ ...filters, similarityThreshold: val })}
                  onArchiveDuplicate={handleArchiveComment}
                  onDismissDuplicate={handleDismissDuplicate}
                  useCustomEmbedding={llmSettings.useCustomEmbedding}
                />
              )}

              {/* SEMANTIC QUERY SEARCH PANEL */}
              {activeTab === "query" && (
                <SemanticQuery
                  comments={comments}
                  llmSettings={llmSettings}
                  selectedCommentId={selectedCommentId}
                  onSelectComment={setSelectedCommentId}
                  onNavigateToExplore={() => setActiveTab("explore")}
                  onReloadProjectionWithQuery={handleReloadProjectionWithQuery}
                  onClearQueryNode={handleClearQueryNode}
                />
              )}

              {/* TAB 3: EXECUTIVE SUMMARY WRITER */}
              {activeTab === "report" && (
                <ExecutiveReport
                  comments={comments}
                  executiveSummary={executiveSummary}
                  isSummarizing={isSummarizing}
                  onGenerateSummary={handleGenerateSummary}
                  apiMode={apiMode}
                />
              )}

              {/* TAB 4: MANAGE DATASETS (IMPORT / EXPORT / UPLOADER) */}
              {activeTab === "data" && (
                <ImportExport
                  onImportSession={handleImportSession}
                  onExportSession={handleExportSession}
                  onImportCSV={handleImportCSV}
                  onStartIndexing={handleStartIndexing}
                  isIndexing={isIndexing}
                />
              )}
            </section>
          </main>
        </>
      )}

      {/* Modern footer section */}
      <footer id="main_footer" className="h-12 bg-[#1A1A1A] text-white flex items-center px-8 justify-between text-[10px] uppercase tracking-widest mt-12 shrink-0">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${llmSettings.useCustomEmbedding ? "bg-[#4A6741] animate-pulse" : "bg-gray-400"}`} />
            Local LLM: {llmSettings.modelName} ({llmSettings.useCustomEmbedding ? "Custom Endpoints" : "Built-in Heuristics"})
          </span>
          <span>Index: Cosine Projection</span>
        </div>
        <div className="flex gap-6">
          <span className="opacity-60">Comment Processor v2.4</span>
        </div>
      </footer>

      {/* Item-by-item Indexing Progress overlay */}
      {isIndexing && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-[#E5E3DF] max-w-md w-full p-8 text-center space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 text-[#1A1A1A] animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">Processing Dataset</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Vectorizing comments row-by-row for 2D semantic projection. This keeps payload size stable and prevents timeout issues.
              </p>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-gray-500">
                <span>Progress</span>
                <span>{indexingProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 h-2 border border-[#E5E3DF]">
                <div 
                  className="bg-[#1A1A1A] h-full transition-all duration-300"
                  style={{ width: `${indexingProgress}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] uppercase tracking-wider font-bold text-[#4A6741] flex items-center justify-center gap-1.5 bg-[#4A6741]/5 py-2.5 border border-[#4A6741]/20">
              <span className="w-1.5 h-1.5 bg-[#4A6741] rounded-full animate-ping" />
              <span>Auto-backups active (Downloads every 200 items)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
