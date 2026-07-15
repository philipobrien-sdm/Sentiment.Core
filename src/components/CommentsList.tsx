import React, { useMemo, useState } from "react";
import { CommentItem, LlmSettings } from "../types";
import { getCommentEmbedding } from "../utils/embeddingsCache";
import { calculateCosineSimilarity } from "./DuplicateReview";
import { fetchLocalCompletion } from "../utils/localLlm";
import { 
  Search, MessageSquare, AlertTriangle, ArrowRight, User, 
  Activity, Clock, Check, Info, Sparkles, Loader2, Filter,
  Building, ThumbsUp, ThumbsDown, HelpCircle, ListFilter,
  Eye, CheckCircle2, ChevronRight, RefreshCw, X, FileText
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface CommentsListProps {
  comments: CommentItem[];
  llmSettings: LlmSettings;
  onSelectCommentGlobal?: (id: string | null) => void;
  selectedCommentIdGlobal?: string | null;
  onSaveSynthesisToHistory?: (synthesis: { title: string; markdown: string; source: string }) => void;
}

export function generateLocalHeuristicPerspectiveSynthesis(
  primary: CommentItem,
  similar: CommentItem[]
): string {
  const positives = similar.filter(c => c.sentiment === "positive");
  const neutrals = similar.filter(c => c.sentiment === "neutral");
  const negatives = similar.filter(c => c.sentiment === "negative");
  
  return `# Comparative Perspective Critique
*Synthesizing stakeholder viewpoints for the topic **"${primary.topic}"** based on the primary selected comment and ${similar.length} related perspective nodes.*

## 1. Primary Perspective Core
- **Selected Comment**: "${primary.text}"
- **Author Organization**: ${primary.organizationName || "*(No Organization)*"}
- **Focal Sentiment**: **${primary.sentiment.toUpperCase()}**

## 2. Juxtaposition of Stakeholder Views
The active workspace contains **${positives.length} positive**, **${neutrals.length} neutral**, and **${negatives.length} negative** viewpoints on this same topic area:

### 🟢 Positive Perspectives
${positives.slice(0, 3).map(p => `- *"Row ${p.csvRowIndex || "?"} (${p.organizationName || "Unknown Org"})"*: "${p.text}"`).join("\n") || "- *No contrasting positive perspectives recorded.*"}

### 🟡 Neutral Perspectives
${neutrals.slice(0, 3).map(n => `- *"Row ${n.csvRowIndex || "?"} (${n.organizationName || "Unknown Org"})"*: "${n.text}"`).join("\n") || "- *No contrasting neutral perspectives recorded.*"}

### 🔴 Negative Perspectives
${negatives.slice(0, 3).map(n => `- *"Row ${n.csvRowIndex || "?"} (${n.organizationName || "Unknown Org"})"*: "${n.text}"`).join("\n") || "- *No contrasting negative perspectives recorded.*"}

## 3. Core Alignment & Tension Points
- **Areas of Consensus**: Across both positive and negative comments, stakeholders focus on the same core functional domain (**${primary.topic}**). They agree on the importance of this feature, although they experience different operational outcomes.
- **Tension & Friction**: The primary friction stems from varying user setups and operational requirements. While positive users commend the implementation, negative users report usability or technical barriers.

## 4. Reconciling Action Plan
1. **Unify Configuration Options**: Build standard options to bridge the gap between positive and negative user scenarios.
2. **Deploy Targeted Optimization**: Direct developer review toward resolving the specific friction raised in the feedback list.
3. **Configure Settings**: To replace this heuristic report with real-time generative analysis, start a local LLM endpoint (Ollama/LM Studio) and connect it in the Settings drawer.`;
}

export const CommentsList: React.FC<CommentsListProps> = ({
  comments,
  llmSettings,
  onSelectCommentGlobal,
  selectedCommentIdGlobal,
  onSaveSynthesisToHistory,
}) => {
  // Local list search & filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedOrg, setSelectedOrg] = useState<string>("");

  // Selected comment local state
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  // Sync with global selection if provided
  const activeSelectedId = selectedCommentIdGlobal !== undefined ? selectedCommentIdGlobal : localSelectedId;
  const setActiveSelectedId = (id: string | null) => {
    if (onSelectCommentGlobal) {
      onSelectCommentGlobal(id);
    }
    setLocalSelectedId(id);
  };

  const selectedComment = useMemo(() => {
    if (!activeSelectedId) return null;
    return comments.find(c => c.id === activeSelectedId) || null;
  }, [activeSelectedId, comments]);

  // Synthesis and analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasMappedPerspectives, setHasMappedPerspectives] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Reset analysis results when selection changes
  React.useEffect(() => {
    setHasMappedPerspectives(false);
    setSynthesisResult(null);
  }, [activeSelectedId]);

  // Extract unique values for filter dropdowns
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    comments.forEach(c => {
      if (c.topic && !c.isArchived) set.add(c.topic);
    });
    return Array.from(set).sort();
  }, [comments]);

  const availableOrgs = useMemo(() => {
    const set = new Set<string>();
    comments.forEach(c => {
      const org = c.organizationName || "(No Organization)";
      if (!c.isArchived) set.add(org);
    });
    return Array.from(set).sort();
  }, [comments]);

  // Filtered comments for the master list
  const filteredCommentsList = useMemo(() => {
    return comments.filter(c => {
      if (c.isArchived) return false;
      if (c.id === "user_query_node") return false;

      // Text search
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchesText = c.text.toLowerCase().includes(query);
        const matchesId = c.id.toLowerCase().includes(query);
        const matchesTopic = (c.topic || "").toLowerCase().includes(query);
        if (!matchesText && !matchesId && !matchesTopic) return false;
      }

      // Sentiment filter
      if (selectedSentiment && c.sentiment !== selectedSentiment) return false;

      // Topic filter
      if (selectedTopic && c.topic !== selectedTopic) return false;

      // Org filter
      if (selectedOrg) {
        const org = c.organizationName || "(No Organization)";
        if (org !== selectedOrg) return false;
      }

      return true;
    });
  }, [comments, searchQuery, selectedSentiment, selectedTopic, selectedOrg]);

  // Similar topic comments calculation
  // "not saying the same thing but speaking to the same topic"
  const similarTopicComments = useMemo(() => {
    if (!selectedComment) return [];

    const currentEmb = getCommentEmbedding(selectedComment, llmSettings.useCustomEmbedding);

    return comments
      .filter((c) => c.id !== selectedComment.id && !c.isArchived && c.id !== "user_query_node")
      .map((c) => {
        let similarity = 0;
        if (currentEmb) {
          const cEmb = getCommentEmbedding(c, llmSettings.useCustomEmbedding);
          if (cEmb) {
            similarity = calculateCosineSimilarity(currentEmb, cEmb);
          }
        }
        return { comment: c, similarity };
      })
      .filter(({ comment, similarity }) => {
        // Match standard: belongs to same topic AND is not a near-identical duplicate (similarity < 0.82)
        // If no embeddings are present, fallback to matching by exact topic name.
        const isSameTopic = comment.topic === selectedComment.topic;
        const isNotDuplicate = similarity < 0.85;

        return isSameTopic && isNotDuplicate;
      })
      .sort((a, b) => b.similarity - a.similarity);
  }, [selectedComment, comments, llmSettings.useCustomEmbedding]);

  // Split similar comments by Sentiment Perspectives
  const perspectives = useMemo(() => {
    const list = similarTopicComments.map(s => s.comment);
    return {
      positive: list.filter(c => c.sentiment === "positive"),
      neutral: list.filter(c => c.sentiment === "neutral"),
      negative: list.filter(c => c.sentiment === "negative"),
    };
  }, [similarTopicComments]);

  // Handle Mapping Action
  const handleMapPerspectives = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setHasMappedPerspectives(true);
    }, 600);
  };

  // Generate perspective synthesis report via LLM
  const handleSynthesizePerspectives = async () => {
    if (!selectedComment) return;
    setIsSynthesizing(true);

    const relatedList = similarTopicComments.map(s => s.comment);

    const structuredPrompt = `You are a Principal Strategic Product & Customer Experience Analyst.
Analyze the following primary stakeholder feedback comment and contrast it with other comments addressing the exact same topic area ("${selectedComment.topic}").
The goal is to compare and synthesize the different viewpoints and opinions, showing how they conflict, align, or highlight different aspects of this same topic so that differing views on a single item can be easily seen and reconciled together.

Primary Selected Comment of Interest:
- Text: "${selectedComment.text}"
- Sentiment: ${selectedComment.sentiment.toUpperCase()}
- Organization/Group: ${selectedComment.organizationName || "N/A"}

Other Perspectives speaking to the same topic ("${selectedComment.topic}") but saying different things:
${relatedList.slice(0, 15).map((c, i) => `[Perspective ${i+1}] Sentiment: ${c.sentiment.toUpperCase()} | Group: ${c.organizationName || "N/A"}\nText: "${c.text}"`).join("\n---\n")}

Please write a gorgeous, highly precise, professional viewpoint synthesis in clean Markdown format:
1. **Core Topic Arena**: Identify the central system, feature, or policy being debated.
2. **Juxtaposition of Views**: Outline how positive, neutral, and negative stakeholders view this topic differently. Highlight specific conflicts, use-cases, or environments.
3. **Areas of Convergence & Divergence**: Highlight where there is agreement, and identify the main pain points driving the tension.
4. **Actionable Recommendations**: Provide 2-3 concrete strategic recommendations for product or engineering teams to reconcile these differing views.`;

    try {
      let resultText = "";
      if (llmSettings.baseUrl && llmSettings.useCustomEmbedding) {
        resultText = await fetchLocalCompletion(structuredPrompt, llmSettings);
      } else {
        // Fallback to beautiful local heuristic
        await new Promise(resolve => setTimeout(resolve, 1000));
        resultText = generateLocalHeuristicPerspectiveSynthesis(selectedComment, relatedList);
      }

      setSynthesisResult(resultText);

      // Save to global history if callback provided
      if (onSaveSynthesisToHistory) {
        onSaveSynthesisToHistory({
          title: `Comparative Perspektive: "${selectedComment.topic}"`,
          markdown: resultText,
          source: "perspective"
        });
      }
    } catch (e) {
      console.error(e);
      // Fallback
      const fallbackText = generateLocalHeuristicPerspectiveSynthesis(selectedComment, relatedList);
      setSynthesisResult(fallbackText);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full" id="comments_list_tab">
      
      {/* LEFT COLUMN: Master List (lg:col-span-5) */}
      <div className="lg:col-span-5 bg-white border border-[#E5E3DF] p-6 flex flex-col h-full min-h-[600px] lg:max-h-[850px] rounded-none">
        <div className="flex items-center gap-2 mb-4">
          <ListFilter className="w-4 h-4 text-[#1A1A1A]" />
          <h3 className="font-serif italic text-lg text-[#1A1A1A]">Stakeholder Comments List</h3>
        </div>

        {/* Filters Panel */}
        <div className="space-y-3 mb-5 pb-5 border-b border-[#E5E3DF]">
          {/* Search text query */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments by text, ID, or topic..."
              className="w-full pl-8 pr-3 py-2 bg-[#F9F8F6] border border-[#E5E3DF] rounded-none text-xs focus:outline-none focus:border-[#1A1A1A] placeholder-gray-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-[#1A1A1A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Sentiment dropdown */}
            <div>
              <select
                value={selectedSentiment}
                onChange={(e) => setSelectedSentiment(e.target.value)}
                className="w-full bg-white border border-[#E5E3DF] rounded-none px-2 py-1.5 focus:outline-none focus:border-[#1A1A1A] text-[10px] uppercase tracking-wider font-semibold text-gray-600"
              >
                <option value="">Sentiment</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>

            {/* Topic dropdown */}
            <div>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-white border border-[#E5E3DF] rounded-none px-2 py-1.5 focus:outline-none focus:border-[#1A1A1A] text-[10px] uppercase tracking-wider font-semibold text-gray-600 truncate"
              >
                <option value="">Topic</option>
                {availableTopics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Org dropdown */}
            <div>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full bg-white border border-[#E5E3DF] rounded-none px-2 py-1.5 focus:outline-none focus:border-[#1A1A1A] text-[10px] uppercase tracking-wider font-semibold text-gray-600 truncate"
              >
                <option value="">Organization</option>
                {availableOrgs.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Comments Scrollable Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[480px]">
          {filteredCommentsList.length > 0 ? (
            filteredCommentsList.map((c) => {
              const isSelected = activeSelectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveSelectedId(c.id)}
                  className={`w-full p-3 text-left border transition-all duration-150 flex flex-col rounded-none ${
                    isSelected 
                      ? "bg-[#1A1A1A] border-[#1A1A1A] text-white" 
                      : "bg-[#F9F8F6]/40 hover:bg-[#F9F8F6]/90 border-[#E5E3DF]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5 gap-2">
                    <span className={`text-[9px] uppercase font-mono tracking-widest font-semibold px-1.5 py-0.5 ${
                      isSelected ? "bg-white/10 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      Row {c.csvRowIndex || "N/A"}
                    </span>
                    <span className={`text-[9px] uppercase font-bold tracking-wider rounded-none px-2 py-0.5 ${
                      c.sentiment === "positive" 
                        ? (isSelected ? "bg-[#4A6741]/40 text-green-300" : "bg-[#4A6741]/10 text-[#4A6741]") 
                        : c.sentiment === "negative"
                        ? (isSelected ? "bg-[#A13D2D]/40 text-red-300" : "bg-[#A13D2D]/10 text-[#A13D2D]")
                        : (isSelected ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600")
                    }`}>
                      {c.sentiment}
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed font-sans line-clamp-3 mb-2 ${
                    isSelected ? "text-gray-200" : "text-gray-700"
                  }`}>
                    {c.text}
                  </p>

                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] pt-1.5 border-t ${
                    isSelected ? "border-white/10 text-gray-400" : "border-[#E5E3DF] text-gray-500"
                  }`}>
                    <span className="flex items-center gap-1 font-semibold">
                      <MessageSquare className="w-3 h-3 opacity-70" />
                      {c.topic || "General"}
                    </span>
                    {c.organizationName && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3 opacity-70" />
                        {c.organizationName}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center border border-dashed border-[#E5E3DF] p-6">
              <AlertTriangle className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-xs font-semibold text-gray-500">No active comments match the filters.</p>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSentiment("");
                  setSelectedTopic("");
                  setSelectedOrg("");
                }}
                className="mt-3 text-[10px] uppercase tracking-wider text-gray-600 underline font-bold cursor-pointer hover:text-[#1A1A1A]"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Footer Stats summary */}
        <div className="mt-4 pt-4 border-t border-[#E5E3DF] flex items-center justify-between text-[10px] font-mono text-gray-400">
          <span>SHOWING {filteredCommentsList.length} OF {comments.filter(c => !c.isArchived && c.id !== "user_query_node").length} ACTIVE FEEDBACK NODES</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Comparative Perspective Center (lg:col-span-7) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Selected Comment card details */}
        {selectedComment ? (
          <div className="bg-white border border-[#E5E3DF] p-6 rounded-none space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E3DF] pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 block mb-0.5">Primary Node of Interest</span>
                <h4 className="font-serif italic text-base text-[#1A1A1A]">Comment Detail Info</h4>
              </div>
              <button 
                onClick={() => setActiveSelectedId(null)}
                className="text-gray-400 hover:text-[#1A1A1A] p-1 cursor-pointer"
                title="Deselect comment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F9F8F6] p-4 border-l-4 border-[#1A1A1A] space-y-2">
              <p className="text-sm text-[#1A1A1A] font-sans leading-relaxed italic">
                "{selectedComment.text}"
              </p>
              
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] pt-2 text-gray-500 font-sans">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <strong>ID:</strong> <code className="bg-[#E5E3DF] px-1 text-[10px]">{selectedComment.id}</code>
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                  <strong>Topic Cluster:</strong> {selectedComment.topic || "General"}
                </span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-gray-400" />
                  <strong>Organization:</strong> {selectedComment.organizationName || "*(No Organization Data)*"}
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-gray-400" />
                  <strong>Focal Sentiment:</strong> 
                  <span className={`capitalize ml-1 font-semibold ${
                    selectedComment.sentiment === "positive" ? "text-[#4A6741]" : selectedComment.sentiment === "negative" ? "text-[#A13D2D]" : "text-gray-600"
                  }`}>{selectedComment.sentiment}</span>
                </span>
              </div>
            </div>

            {!hasMappedPerspectives && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleMapPerspectives}
                  disabled={isAnalyzing}
                  className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-[#333333] text-white px-5 py-2.5 rounded-none text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mapping Topic Neighbors...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Map Topic Perspectives ({similarTopicComments.length} Neighbors)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#E5E3DF] p-12 rounded-none text-center h-[200px] flex flex-col items-center justify-center">
            <MessageSquare className="w-8 h-8 text-gray-300 mb-3" />
            <h4 className="font-serif italic text-base text-[#1A1A1A] mb-1">Perspective Arena Offline</h4>
            <p className="text-xs text-gray-400 max-w-sm">
              Select any stakeholder feedback comment from the list on the left to map other perspectives speaking to the same topic.
            </p>
          </div>
        )}

        {/* PERSPECTIVES JUXTAPOSITION BOARD */}
        {selectedComment && hasMappedPerspectives && (
          <div className="space-y-6">
            
            {/* Perspective board summary block */}
            <div className="bg-white border border-[#E5E3DF] p-6 rounded-none space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E3DF] pb-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 block mb-0.5">Topic Perspectives Arena</span>
                  <h3 className="font-serif italic text-lg text-[#1A1A1A]">
                    Stakeholder Contrast Board: "{selectedComment.topic}"
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Found **{similarTopicComments.length} other comments** speaking to the exact same topic but offering diverse perspectives.
                  </p>
                </div>

                <button
                  onClick={handleSynthesizePerspectives}
                  disabled={isSynthesizing}
                  className="bg-[#4A6741] hover:bg-[#3D5535] text-white px-4 py-2.5 rounded-none text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Synthesize Perspectives</span>
                    </>
                  )}
                </button>
              </div>

              {/* THREE COLUMN GRID OF SENTIMENTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* COLUMN 1: POSITIVE VIEWPOINTS */}
                <div className="border border-[#E5E3DF] p-4 bg-[#F9F8F6]/10 flex flex-col h-[320px]">
                  <div className="flex items-center gap-1.5 border-b border-[#E5E3DF] pb-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-[#4A6741]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Positive views ({perspectives.positive.length})</h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                    {perspectives.positive.length > 0 ? (
                      perspectives.positive.map((p, idx) => (
                        <div key={p.id} className="p-2.5 bg-white border border-[#E5E3DF] text-gray-600 text-[11px] leading-relaxed relative hover:border-[#1A1A1A] transition-colors">
                          <p className="italic">"{p.text}"</p>
                          <div className="mt-1.5 text-[9px] text-gray-400 flex items-center justify-between font-mono">
                            <span>Row {p.csvRowIndex || "?"}</span>
                            <span>{p.organizationName || "Unknown Org"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-center py-8">No opposing positive views on this topic.</p>
                    )}
                  </div>
                </div>

                {/* COLUMN 2: NEUTRAL VIEWPOINTS */}
                <div className="border border-[#E5E3DF] p-4 bg-[#F9F8F6]/10 flex flex-col h-[320px]">
                  <div className="flex items-center gap-1.5 border-b border-[#E5E3DF] pb-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Neutral views ({perspectives.neutral.length})</h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                    {perspectives.neutral.length > 0 ? (
                      perspectives.neutral.map((n, idx) => (
                        <div key={n.id} className="p-2.5 bg-white border border-[#E5E3DF] text-gray-600 text-[11px] leading-relaxed relative hover:border-[#1A1A1A] transition-colors">
                          <p className="italic">"{n.text}"</p>
                          <div className="mt-1.5 text-[9px] text-gray-400 flex items-center justify-between font-mono">
                            <span>Row {n.csvRowIndex || "?"}</span>
                            <span>{n.organizationName || "Unknown Org"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-center py-8">No opposing neutral views on this topic.</p>
                    )}
                  </div>
                </div>

                {/* COLUMN 3: NEGATIVE VIEWPOINTS */}
                <div className="border border-[#E5E3DF] p-4 bg-[#F9F8F6]/10 flex flex-col h-[320px]">
                  <div className="flex items-center gap-1.5 border-b border-[#E5E3DF] pb-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-[#A13D2D]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Negative views ({perspectives.negative.length})</h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                    {perspectives.negative.length > 0 ? (
                      perspectives.negative.map((n, idx) => (
                        <div key={n.id} className="p-2.5 bg-white border border-[#E5E3DF] text-gray-600 text-[11px] leading-relaxed relative hover:border-[#1A1A1A] transition-colors">
                          <p className="italic">"{n.text}"</p>
                          <div className="mt-1.5 text-[9px] text-gray-400 flex items-center justify-between font-mono">
                            <span>Row {n.csvRowIndex || "?"}</span>
                            <span>{n.organizationName || "Unknown Org"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-center py-8">No opposing negative views on this topic.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* SYNTHESIS DETAILS REPORT */}
            {synthesisResult && (
              <div className="bg-white border border-[#E5E3DF] p-6 rounded-none space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="flex items-center justify-between border-b border-[#E5E3DF] pb-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#4A6741]" />
                    <h4 className="font-serif italic text-base text-[#1A1A1A]">AI Perspective Contrast Synthesis</h4>
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#4A6741] font-bold">REPORT GENERATED</span>
                </div>

                <div className="markdown-body text-xs max-h-[400px] overflow-y-auto pr-1">
                  <MarkdownViewer markdown={synthesisResult} />
                </div>
              </div>
            )}

          </div>
        )}

      </div>
      
    </div>
  );
};
