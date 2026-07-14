import React from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { X, Calendar, Sparkles, Copy, Download, Trash2, Clock, Map, Layers } from "lucide-react";

export interface SavedSynthesis {
  id: string;
  title: string;
  markdown: string;
  timestamp: string;
  source: "map" | "cluster";
}

interface SynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSynthesis: SavedSynthesis | null;
  history: SavedSynthesis[];
  onSelectHistoryItem: (item: SavedSynthesis) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
}

export const SynthesisModal: React.FC<SynthesisModalProps> = ({
  isOpen,
  onClose,
  activeSynthesis,
  history,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    if (!activeSynthesis) return;
    navigator.clipboard.writeText(activeSynthesis.markdown);
    alert("Critique copied to clipboard!");
  };

  const handleDownload = () => {
    if (!activeSynthesis) return;
    const blob = new Blob([activeSynthesis.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSynthesis.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_synthesis.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#E5E3DF] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col rounded-none overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-serif italic text-lg leading-none">LLM Critical Synthesis Hub</h2>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-mono mt-1">Advanced Vector-Semantic Auditing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body (Two-column layout) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Panel: Saved Summaries History */}
          <div className="hidden md:flex w-72 bg-[#F9F8F6] border-r border-[#E5E3DF] flex-col shrink-0">
            <div className="p-4 border-b border-[#E5E3DF] flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> Synthesis History ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-[9px] font-mono uppercase text-[#A13D2D] hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {history.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-1">
                  <p className="text-xs font-semibold text-[#1A1A1A]/40 uppercase tracking-wider">No saved history</p>
                  <p className="text-[10px] text-gray-400 leading-normal">Your critical neighborhood and cluster reports will accumulate here.</p>
                </div>
              ) : (
                history.map((item) => {
                  const isActive = activeSynthesis?.id === item.id;
                  const Icon = item.source === "map" ? Map : Layers;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectHistoryItem(item)}
                      className={`group relative p-3 border transition-all cursor-pointer flex gap-2.5 items-start ${
                        isActive
                          ? "bg-white border-[#1A1A1A] shadow-sm"
                          : "bg-[#F9F8F6] border-[#E5E3DF] hover:bg-white hover:border-gray-400"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? "text-[#4A6741]" : "text-gray-400"}`} />
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-xs font-bold leading-snug truncate ${isActive ? "text-[#1A1A1A]" : "text-gray-700"}`}>
                          {item.title}
                        </p>
                        <span className="text-[9px] font-mono text-gray-400 block mt-1">
                          {item.timestamp}
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistoryItem(item.id);
                        }}
                        title="Delete critique"
                        className="absolute right-2.5 top-3 opacity-0 group-hover:opacity-100 hover:text-[#A13D2D] text-gray-400 transition-opacity p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Selected Active Critique */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {activeSynthesis ? (
              <>
                {/* Active Critique Information */}
                <div className="px-6 py-4 border-b border-[#E5E3DF] bg-[#F9F8F6]/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider ${
                        activeSynthesis.source === "map" 
                          ? "bg-blue-50 border border-blue-200 text-blue-600" 
                          : "bg-purple-50 border border-purple-200 text-purple-600"
                      }`}>
                        {activeSynthesis.source === "map" ? "Semantic Neighborhood" : "Deduplication Cluster"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">{activeSynthesis.timestamp}</span>
                    </div>
                    <h3 className="text-base font-serif italic text-[#1A1A1A] font-bold">
                      {activeSynthesis.title}
                    </h3>
                  </div>

                  {/* Actions for active report */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 border border-[#E5E3DF] hover:border-[#1A1A1A] bg-white text-[10px] font-mono uppercase font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy MD
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-[10px] font-mono uppercase font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Save .md
                    </button>
                  </div>
                </div>

                {/* Markdown view area */}
                <div className="flex-1 overflow-y-auto p-8 prose max-w-none">
                  <MarkdownViewer markdown={activeSynthesis.markdown} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <Sparkles className="w-8 h-8 mb-3 text-gray-300" />
                <h4 className="font-serif italic text-lg text-[#1A1A1A] mb-1">No critique active</h4>
                <p className="text-xs max-w-sm leading-relaxed text-gray-400">
                  Select a past report from the history sidebar, or trigger a new critical synthesis from the Similarity Plot or Deduplication tabs.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer (mobile only view of history toggle, or standard close bar) */}
        <div className="bg-[#F9F8F6] border-t border-[#E5E3DF] px-6 py-3.5 flex justify-end gap-2.5 shrink-0">
          {/* Small helper for mobile screens */}
          <div className="mr-auto flex items-center gap-1.5 text-[10px] font-medium text-gray-500 md:hidden">
            <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
            Saved history counts: {history.length}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white font-mono text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-colors"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
};
