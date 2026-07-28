import React, { useState, useMemo, useEffect } from "react";
import { 
  FolderKanban, Sparkles, Filter, Search, Download, 
  CheckCircle2, ArrowUpDown, Tag, Building2, Smile, Frown, Meh,
  RefreshCw, Loader2, Info, ChevronRight, Layers, FileSpreadsheet, Check
} from "lucide-react";
import { CommentItem, LlmSettings } from "../types";
import { calculateCosineSimilarity } from "./DuplicateReview";
import { fetchLocalEmbeddings, getDeterministicPseudoEmbedding } from "../utils/localLlm";
import { getCommentEmbedding } from "../utils/embeddingsCache";

interface CustomTopicClusterViewProps {
  comments: CommentItem[];
  llmSettings: LlmSettings;
  onApplyTopicsToDataset: (updatedComments: CommentItem[]) => void;
  showToast: (message: string, type: 'info' | 'success' | 'error') => void;
  onSelectComment?: (commentId: string) => void;
}

interface ClusteredCommentItem extends CommentItem {
  assignedTopic: string;
  similarityScore: number;
}

interface ClusterGroup {
  topicName: string;
  comments: ClusteredCommentItem[];
  avgSimilarity: number;
  sentimentCounts: {
    positive: number;
    neutral: number;
    negative: number;
  };
  organizations: string[];
}

const DEFAULT_PRESET_TOPICS = [
  "Performance, Speed & Lag",
  "UI/UX, Navigation & Layout",
  "Pricing, Billing & Value",
  "Customer Support & Service",
  "Bugs, Crashes & System Failures",
  "Feature Requests & Enhancements"
];

export const CustomTopicClusterView: React.FC<CustomTopicClusterViewProps> = ({
  comments,
  llmSettings,
  onApplyTopicsToDataset,
  showToast,
  onSelectComment
}) => {
  // Topic input state (newline or comma separated or raw text)
  const [topicInputText, setTopicInputText] = useState<string>(DEFAULT_PRESET_TOPICS.join("\n"));
  
  // Cutoff similarity threshold (default 0 = best-match assignment)
  const [minThreshold, setMinThreshold] = useState<number>(0.0);

  // Clustering execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>([]);
  const [unassignedComments, setUnassignedComments] = useState<ClusteredCommentItem[]>([]);
  const [hasRunClustering, setHasRunClustering] = useState<boolean>(false);

  // Selected cluster topic from dropdown
  const [selectedTopic, setSelectedTopic] = useState<string>("");

  // Table filters & sorting within selected cluster
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [sortField, setSortField] = useState<'score' | 'id' | 'org' | 'sentiment'>('score');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Parse candidate topic strings
  const parsedTopics = useMemo(() => {
    return topicInputText
      .split(/[\n,]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }, [topicInputText]);

  // Execute Embedding Clustering
  const handleRunClustering = async () => {
    const topicsToCluster = parsedTopics;
    if (topicsToCluster.length === 0) {
      showToast("Please enter at least one cluster topic name.", "error");
      return;
    }

    if (comments.length === 0) {
      showToast("No active comments in dataset to cluster.", "error");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Compute/Fetch Vector Embeddings for each defined Topic
      let topicEmbeddings: number[][] = [];

      if (llmSettings.useCustomEmbedding) {
        showToast("Fetching topic embeddings from local LLM endpoint...", "info");
        topicEmbeddings = await fetchLocalEmbeddings(topicsToCluster, llmSettings);
      } else {
        topicEmbeddings = topicsToCluster.map(t => getDeterministicPseudoEmbedding(t));
      }

      // Map topic -> vector
      const topicVectors = topicsToCluster.map((topicName, idx) => ({
        topicName,
        vector: topicEmbeddings[idx] || getDeterministicPseudoEmbedding(topicName)
      }));

      // 2. Classify each comment to its nearest topic vector
      const activeComments = comments.filter(c => !c.isArchived && c.id !== "user_query_node");
      
      const groupsMap = new Map<string, ClusteredCommentItem[]>();
      topicsToCluster.forEach(t => groupsMap.set(t, []));

      const unassigned: ClusteredCommentItem[] = [];

      for (const comment of activeComments) {
        const commentVec = getCommentEmbedding(comment, llmSettings.useCustomEmbedding);
        
        let bestTopic = "";
        let maxSimilarity = -1;

        if (commentVec && commentVec.length > 0) {
          for (const tv of topicVectors) {
            const sim = calculateCosineSimilarity(commentVec, tv.vector);
            if (sim > maxSimilarity) {
              maxSimilarity = sim;
              bestTopic = tv.topicName;
            }
          }
        }

        const clusteredItem: ClusteredCommentItem = {
          ...comment,
          assignedTopic: maxSimilarity >= minThreshold ? bestTopic : "Unassigned / Low Confidence",
          similarityScore: maxSimilarity > -1 ? maxSimilarity : 0
        };

        if (maxSimilarity >= minThreshold && bestTopic) {
          const list = groupsMap.get(bestTopic) || [];
          list.push(clusteredItem);
          groupsMap.set(bestTopic, list);
        } else {
          unassigned.push(clusteredItem);
        }
      }

      // 3. Build cluster group metrics
      const constructedGroups: ClusterGroup[] = topicsToCluster.map(topicName => {
        const groupComments = groupsMap.get(topicName) || [];
        
        const totalSim = groupComments.reduce((acc, c) => acc + c.similarityScore, 0);
        const avgSimilarity = groupComments.length > 0 ? totalSim / groupComments.length : 0;

        const sentimentCounts = {
          positive: groupComments.filter(c => c.sentiment === "positive").length,
          neutral: groupComments.filter(c => c.sentiment === "neutral").length,
          negative: groupComments.filter(c => c.sentiment === "negative").length,
        };

        // Extract unique org names
        const orgsSet = new Set<string>();
        groupComments.forEach(c => {
          const org = c.organizationName || c.originalRowData?.["Organization"] || c.originalRowData?.["Org"] || c.originalRowData?.["Organization Name"];
          if (org && org.trim()) {
            orgsSet.add(org.trim());
          }
        });

        return {
          topicName,
          comments: groupComments,
          avgSimilarity,
          sentimentCounts,
          organizations: Array.from(orgsSet).sort()
        };
      });

      setClusterGroups(constructedGroups);
      setUnassignedComments(unassigned);
      setHasRunClustering(true);

      // Default dropdown selection to topic with highest count or first topic
      const nonZeroGroup = constructedGroups.find(g => g.comments.length > 0) || constructedGroups[0];
      if (nonZeroGroup) {
        setSelectedTopic(nonZeroGroup.topicName);
      } else if (unassigned.length > 0) {
        setSelectedTopic("Unassigned / Low Confidence");
      }

      showToast(`Grouped ${activeComments.length} comments across ${topicsToCluster.length} custom topics using vector similarity!`, "success");
    } catch (error: any) {
      console.error("Clustering error:", error);
      showToast(`Clustering failed: ${error.message || "Unknown error"}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Run initial clustering on mount if not run yet
  useEffect(() => {
    if (!hasRunClustering && comments.length > 0) {
      handleRunClustering();
    }
  }, [comments.length]);

  // Currently selected cluster group object
  const currentGroup = useMemo(() => {
    if (selectedTopic === "Unassigned / Low Confidence") {
      const sentimentCounts = {
        positive: unassignedComments.filter(c => c.sentiment === "positive").length,
        neutral: unassignedComments.filter(c => c.sentiment === "neutral").length,
        negative: unassignedComments.filter(c => c.sentiment === "negative").length,
      };
      const orgsSet = new Set<string>();
      unassignedComments.forEach(c => {
        const org = c.organizationName || c.originalRowData?.["Organization"] || c.originalRowData?.["Org"];
        if (org) orgsSet.add(org);
      });
      return {
        topicName: "Unassigned / Low Confidence",
        comments: unassignedComments,
        avgSimilarity: unassignedComments.length > 0 ? unassignedComments.reduce((acc, c) => acc + c.similarityScore, 0) / unassignedComments.length : 0,
        sentimentCounts,
        organizations: Array.from(orgsSet)
      };
    }
    return clusterGroups.find(g => g.topicName === selectedTopic) || null;
  }, [selectedTopic, clusterGroups, unassignedComments]);

  // Filter & sort comments inside the selected cluster
  const filteredClusterComments = useMemo(() => {
    if (!currentGroup) return [];

    let list = [...currentGroup.comments];

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(c => {
        const idStr = (c.originalId || c.id || "").toLowerCase();
        const orgStr = (c.organizationName || c.originalRowData?.["Organization"] || "").toLowerCase();
        const textStr = (c.text || "").toLowerCase();
        return idStr.includes(query) || orgStr.includes(query) || textStr.includes(query);
      });
    }

    // Sentiment filter
    if (sentimentFilter !== "all") {
      list = list.filter(c => c.sentiment === sentimentFilter);
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "score") {
        comparison = b.similarityScore - a.similarityScore;
      } else if (sortField === "id") {
        const idA = a.originalId || a.id || "";
        const idB = b.originalId || b.id || "";
        comparison = idA.localeCompare(idB);
      } else if (sortField === "org") {
        const orgA = a.organizationName || a.originalRowData?.["Organization"] || "";
        const orgB = b.organizationName || b.originalRowData?.["Organization"] || "";
        comparison = orgA.localeCompare(orgB);
      } else if (sortField === "sentiment") {
        comparison = a.sentiment.localeCompare(b.sentiment);
      }

      return sortDirection === "desc" ? comparison : -comparison;
    });

    return list;
  }, [currentGroup, searchQuery, sentimentFilter, sortField, sortDirection]);

  // Apply custom cluster topic assignments back to main dataset
  const handleApplyToMainDataset = () => {
    if (!hasRunClustering || clusterGroups.length === 0) {
      showToast("Please run clustering first before applying to the main dataset.", "error");
      return;
    }

    // Map each comment ID to its newly assigned topic
    const topicMap = new Map<string, string>();
    clusterGroups.forEach(g => {
      g.comments.forEach(c => {
        topicMap.set(c.id, g.topicName);
      });
    });
    unassignedComments.forEach(c => {
      topicMap.set(c.id, "Unassigned / General");
    });

    const updated = comments.map(c => {
      if (topicMap.has(c.id)) {
        return { ...c, topic: topicMap.get(c.id)! };
      }
      return c;
    });

    onApplyTopicsToDataset(updated);
    showToast("Applied custom cluster topics to the active dataset!", "success");
  };

  // Export selected cluster or all clusters to CSV
  const handleExportCSV = (exportAll: boolean = false) => {
    let rowsToExport: ClusteredCommentItem[] = [];

    if (exportAll) {
      clusterGroups.forEach(g => rowsToExport.push(...g.comments));
      rowsToExport.push(...unassignedComments);
    } else if (currentGroup) {
      rowsToExport = currentGroup.comments;
    }

    if (rowsToExport.length === 0) {
      showToast("No rows available to export.", "error");
      return;
    }

    const headers = ["Comment_ID", "Organization_Name", "Feedback_Text", "Sentiment", "Assigned_Cluster_Topic", "Vector_Match_Score"];
    
    const csvContent = [
      headers.join(","),
      ...rowsToExport.map(c => {
        const id = c.originalId || c.id;
        const org = c.organizationName || c.originalRowData?.["Organization"] || c.originalRowData?.["Org"] || "N/A";
        const text = `"${(c.text || "").replace(/"/g, '""')}"`;
        const sentiment = c.sentiment;
        const topic = `"${(c.assignedTopic || "").replace(/"/g, '""')}"`;
        const score = (c.similarityScore * 100).toFixed(1) + "%";

        return [id, `"${org.replace(/"/g, '""')}"`, text, sentiment, topic, score].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `custom_topic_cluster_${exportAll ? "all" : selectedTopic.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${rowsToExport.length} rows to CSV!`, "success");
  };

  // Helper to add preset topic
  const handleAddPresetTopic = (preset: string) => {
    if (!parsedTopics.includes(preset)) {
      setTopicInputText(prev => prev ? `${prev.trim()}\n${preset}` : preset);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. TOPIC DEFINITION & EMBEDDING CLUSTERING CONTROLS */}
      <div className="bg-white border border-[#E5E3DF] p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E3DF] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-[#4A6741]" />
              <h3 className="font-serif italic text-lg font-bold text-[#1A1A1A]">
                Custom Embedding Topic Clustering
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Define target cluster topics. High-dimensional vector similarity automatically maps each comment to its nearest semantic topic, capturing original IDs, Organization names, Comments, and Sentiment.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunClustering}
              disabled={isProcessing || parsedTopics.length === 0}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#333333] disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all rounded-none"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4A6741]" />
                  <span>Grouping via Vectors...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#4A6741]" />
                  <span>Group Comments by Topics</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Input area & Presets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
          {/* Textarea for topic list */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Target Cluster Topics (One per line or comma-separated)
              </label>
              <span className="text-[10px] text-gray-400 font-mono">
                {parsedTopics.length} topic{parsedTopics.length === 1 ? "" : "s"} defined
              </span>
            </div>
            <textarea
              value={topicInputText}
              onChange={(e) => setTopicInputText(e.target.value)}
              placeholder="e.g. Performance & Speed&#10;UI/UX & Layout&#10;Pricing & Subscriptions"
              rows={4}
              className="w-full bg-[#F9F8F6] border border-[#E5E3DF] p-3 text-xs focus:outline-none focus:border-[#1A1A1A] font-sans leading-relaxed rounded-none resize-none"
            />
          </div>

          {/* Quick preset chips & settings */}
          <div className="space-y-3 bg-[#F9F8F6]/60 border border-[#E5E3DF] p-3.5">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Quick Add Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_PRESET_TOPICS.map((preset) => {
                const isAdded = parsedTopics.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddPresetTopic(preset)}
                    className={`px-2 py-1 text-[10px] border transition-all cursor-pointer flex items-center gap-1 ${
                      isAdded 
                        ? "bg-[#4A6741]/10 border-[#4A6741] text-[#4A6741] font-medium" 
                        : "bg-white border-[#E5E3DF] text-gray-600 hover:border-[#1A1A1A]"
                    }`}
                  >
                    {isAdded ? <Check className="w-2.5 h-2.5" /> : <span>+</span>}
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#E5E3DF] space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-gray-600">
                <span>Min Similarity Cutoff:</span>
                <span className="font-mono text-[#4A6741]">{(minThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.6"
                step="0.05"
                value={minThreshold}
                onChange={(e) => setMinThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#4A6741] cursor-pointer"
              />
              <p className="text-[9px] text-gray-400 leading-tight">
                Comments below cutoff default to "Unassigned". Leave at 0% for nearest-neighbor mapping.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CLUSTER SELECTOR & METRICS SUMMARY BAR */}
      {hasRunClustering && (
        <div className="space-y-4">
          
          {/* Main Dropdown & Export Header */}
          <div className="bg-[#1A1A1A] text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-[#4A6741]">
            <div className="flex-1 space-y-1">
              <label className="block text-[9px] font-mono text-gray-400 uppercase tracking-widest font-bold">
                Select Cluster Topic View
              </label>
              
              <div className="flex items-center gap-3">
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="bg-white text-[#1A1A1A] border-none px-3.5 py-2 text-sm font-bold focus:outline-none rounded-none cursor-pointer w-full max-w-md shadow-xs"
                >
                  {clusterGroups.map((group) => (
                    <option key={group.topicName} value={group.topicName}>
                      {group.topicName} ({group.comments.length} comment{group.comments.length === 1 ? "" : "s"})
                    </option>
                  ))}
                  {unassignedComments.length > 0 && (
                    <option value="Unassigned / Low Confidence">
                      Unassigned / Low Confidence ({unassignedComments.length} comment{unassignedComments.length === 1 ? "" : "s"})
                    </option>
                  )}
                </select>

                <span className="hidden sm:inline-block text-xs font-mono text-gray-300">
                  {currentGroup ? `${currentGroup.comments.length} records mapped` : ""}
                </span>
              </div>
            </div>

            {/* Actions: Apply to Main Dataset & Export CSV */}
            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
              <button
                onClick={handleApplyToMainDataset}
                className="px-3.5 py-2 bg-[#4A6741] hover:bg-[#3D5535] text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Apply these custom cluster topic labels across all tabs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply to Dataset</span>
              </button>

              <button
                onClick={() => handleExportCSV(false)}
                className="px-3 py-2 border border-white/20 hover:bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Export this cluster to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Cluster</span>
              </button>

              <button
                onClick={() => handleExportCSV(true)}
                className="px-3 py-2 border border-white/20 hover:bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Export all custom clusters to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
                <span>Export All</span>
              </button>
            </div>
          </div>

          {/* Cluster Summary Metrics Dashboard */}
          {currentGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Total Volume */}
              <div className="bg-white border border-[#E5E3DF] p-3.5 space-y-1">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-gray-400 block">
                  Cluster Comment Volume
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-[#1A1A1A]">
                    {currentGroup.comments.length}
                  </span>
                  <span className="text-xs font-mono text-gray-500 font-semibold">
                    {comments.length > 0 ? ((currentGroup.comments.length / comments.length) * 100).toFixed(1) : 0}% of dataset
                  </span>
                </div>
              </div>

              {/* Card 2: Vector Match Strength */}
              <div className="bg-white border border-[#E5E3DF] p-3.5 space-y-1">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-gray-400 block">
                  Avg Vector Match Score
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-[#4A6741]">
                    {(currentGroup.avgSimilarity * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    Cosine Similarity
                  </span>
                </div>
              </div>

              {/* Card 3: Sentiment Breakdown */}
              <div className="bg-white border border-[#E5E3DF] p-3.5 space-y-1">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-gray-400 block">
                  Cluster Sentiment Split
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 text-[10px] font-bold font-mono flex items-center gap-1">
                    <Smile className="w-3 h-3 text-green-600" />
                    <span>{currentGroup.sentimentCounts.positive}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold font-mono flex items-center gap-1">
                    <Meh className="w-3 h-3 text-gray-500" />
                    <span>{currentGroup.sentimentCounts.neutral}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold font-mono flex items-center gap-1">
                    <Frown className="w-3 h-3 text-red-600" />
                    <span>{currentGroup.sentimentCounts.negative}</span>
                  </span>
                </div>
              </div>

              {/* Card 4: Organizations Represented */}
              <div className="bg-white border border-[#E5E3DF] p-3.5 space-y-1">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-gray-400 block">
                  Organizations Represented
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#1A1A1A]">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-lg font-bold">
                      {currentGroup.organizations.length}
                    </span>
                    <span className="text-xs text-gray-500">orgs</span>
                  </div>
                  {currentGroup.organizations.length > 0 && (
                    <span className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]" title={currentGroup.organizations.join(", ")}>
                      {currentGroup.organizations.slice(0, 2).join(", ")}{currentGroup.organizations.length > 2 ? "..." : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. TABLE FILTER & SEARCH CONTROLS */}
          <div className="bg-white border border-[#E5E3DF] p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cluster comments by ID, text, organization..."
                className="w-full bg-[#F9F8F6] border border-[#E5E3DF] pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#1A1A1A] rounded-none"
              />
            </div>

            {/* Sentiment Filter Pills & Sort Dropdown */}
            <div className="flex items-center gap-2 overflow-x-auto shrink-0">
              <div className="flex border border-[#E5E3DF] bg-[#F9F8F6] p-0.5 text-[10px]">
                {(['all', 'positive', 'neutral', 'negative'] as const).map((sent) => (
                  <button
                    key={sent}
                    onClick={() => setSentimentFilter(sent)}
                    className={`px-2.5 py-1 uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                      sentimentFilter === sent 
                        ? "bg-[#1A1A1A] text-white" 
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {sent}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1 border border-[#E5E3DF] px-2 py-1 bg-white text-xs">
                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="bg-transparent text-[11px] font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="score">Sort by Vector Match</option>
                  <option value="id">Sort by Comment ID</option>
                  <option value="org">Sort by Organization</option>
                  <option value="sentiment">Sort by Sentiment</option>
                </select>
                <button
                  onClick={() => setSortDirection(prev => prev === "desc" ? "asc" : "desc")}
                  className="text-gray-500 hover:text-[#1A1A1A] font-mono font-bold px-1"
                  title="Toggle sort direction"
                >
                  {sortDirection === "desc" ? "↓" : "↑"}
                </button>
              </div>
            </div>
          </div>

          {/* 4. RELEVANT ROWS TABLE VIEW */}
          <div className="bg-white border border-[#E5E3DF] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F9F8F6] border-b border-[#E5E3DF] text-[9px] uppercase font-mono tracking-widest text-gray-500 font-bold">
                    <th className="py-3 px-4 w-28">Comment ID</th>
                    <th className="py-3 px-4 w-44">Organization</th>
                    <th className="py-3 px-4">Comment Text</th>
                    <th className="py-3 px-4 w-28">Sentiment</th>
                    <th className="py-3 px-4 w-32 text-right">Vector Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E3DF]">
                  {filteredClusterComments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 space-y-2">
                        <Info className="w-6 h-6 mx-auto text-gray-300" />
                        <p className="text-xs font-serif italic">No comment rows found matching the filter criteria in this cluster topic.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClusterComments.map((comment) => {
                      const commentIdDisplay = comment.originalId || comment.id;
                      const orgNameDisplay = comment.organizationName || comment.originalRowData?.["Organization"] || comment.originalRowData?.["Org"] || comment.originalRowData?.["Organization Name"] || "—";
                      
                      return (
                        <tr 
                          key={comment.id}
                          className="hover:bg-[#F9F8F6]/80 transition-colors group"
                        >
                          {/* ID Column */}
                          <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-[#1A1A1A] align-top whitespace-nowrap">
                            <span className="bg-gray-100 px-1.5 py-0.5 border border-gray-200">
                              {commentIdDisplay}
                            </span>
                          </td>

                          {/* Organization Name Column */}
                          <td className="py-3.5 px-4 font-medium text-gray-700 align-top">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[150px]" title={orgNameDisplay}>
                                {orgNameDisplay}
                              </span>
                            </div>
                          </td>

                          {/* Comment Text Column */}
                          <td className="py-3.5 px-4 text-gray-800 leading-relaxed align-top">
                            <p className="font-sans text-xs">
                              {comment.text}
                            </p>
                            {comment.originalRowData && Object.keys(comment.originalRowData).length > 2 && (
                              <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-mono text-gray-400">
                                {Object.entries(comment.originalRowData)
                                  .filter(([key]) => !["comment", "text", "id", "sentiment", "organization", "org"].includes(key.toLowerCase()))
                                  .slice(0, 3)
                                  .map(([k, v]) => (
                                    <span key={k} className="bg-gray-50 border border-gray-200 px-1">
                                      {k}: {String(v)}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </td>

                          {/* Sentiment Column */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            {comment.sentiment === "positive" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 text-green-800 text-[10px] font-bold uppercase tracking-wider">
                                <Smile className="w-3 h-3 text-green-600" />
                                <span>Positive</span>
                              </span>
                            )}
                            {comment.sentiment === "neutral" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider">
                                <Meh className="w-3 h-3 text-gray-500" />
                                <span>Neutral</span>
                              </span>
                            )}
                            {comment.sentiment === "negative" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-800 text-[10px] font-bold uppercase tracking-wider">
                                <Frown className="w-3 h-3 text-red-600" />
                                <span>Negative</span>
                              </span>
                            )}
                          </td>

                          {/* Vector Match Score Column */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono font-bold text-xs text-[#4A6741]">
                                {(comment.similarityScore * 100).toFixed(1)}% Match
                              </span>
                              <div className="w-16 bg-gray-100 h-1 mt-1 overflow-hidden">
                                <div 
                                  className="bg-[#4A6741] h-full" 
                                  style={{ width: `${Math.min(100, Math.max(0, comment.similarityScore * 100))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-[#F9F8F6] border-t border-[#E5E3DF] flex justify-between items-center text-[10px] font-mono text-gray-500">
              <span>Showing {filteredClusterComments.length} of {currentGroup.comments.length} rows in topic cluster</span>
              <span>Vector Similarity Engine • {llmSettings.useCustomEmbedding ? llmSettings.embeddingModel : "Deterministic Embeddings"}</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
