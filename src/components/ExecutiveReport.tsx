import React from "react";
import { CommentItem } from "../types";
import { Sparkles, FileText, Download, Loader2, ArrowRight, History } from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface ExecutiveReportProps {
  comments: CommentItem[];
  executiveSummary: string | null;
  isSummarizing: boolean;
  onGenerateSummary: () => void;
  apiMode: 'live' | 'demo';
  onOpenHistory?: () => void;
  historyCount?: number;
}

export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({
  comments,
  executiveSummary,
  isSummarizing,
  onGenerateSummary,
  apiMode,
  onOpenHistory,
  historyCount = 0,
}) => {
  const activeComments = comments.filter((c) => !c.isArchived);

  // Trigger export of report to a Text/Markdown file
  const handleExportReport = () => {
    if (!executiveSummary) return;
    const blob = new Blob([executiveSummary], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `comment_executive_synthesis_${new Date().toISOString().split('T')[0]}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-[#E5E3DF] rounded-none flex flex-col min-h-[480px] shadow-none animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-[#E5E3DF] flex items-center justify-between bg-[#F9F8F6]/45">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-[#1A1A1A]" />
          <h2 className="font-serif italic text-base text-[#1A1A1A]">Executive Synthesis & Common Themes</h2>
        </div>
        
        <div className="flex items-center gap-3">
          {apiMode === "live" ? (
            <span className="text-[10px] bg-[#4A6741]/10 border border-[#4A6741]/20 text-[#4A6741] px-2.5 py-1 rounded-none font-semibold font-mono uppercase tracking-wider">
              Gemini LLM Active
            </span>
          ) : (
            <span className="text-[10px] bg-[#A13D2D]/10 border border-[#A13D2D]/20 text-[#A13D2D] px-2.5 py-1 rounded-none font-semibold font-mono uppercase tracking-wider">
              Local Heuristics
            </span>
          )}

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="px-3 py-1.5 border border-[#E5E3DF] hover:border-[#1A1A1A] hover:bg-[#F9F8F6] text-[#1A1A1A] rounded-none text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5 transition-colors bg-white cursor-pointer"
              title="Open LLM critique history modal"
            >
              <History className="w-3.5 h-3.5 text-amber-500" /> Synthesis History ({historyCount})
            </button>
          )}

          {executiveSummary && (
            <button
              onClick={handleExportReport}
              className="px-3 py-1.5 border border-[#1A1A1A] hover:bg-[#F9F8F6] text-[#1A1A1A] rounded-none text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5 transition-colors bg-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Synthesis
            </button>
          )}
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 p-6 flex flex-col">
        {isSummarizing ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1A1A1A] animate-spin mb-4" />
            <h3 className="font-serif italic text-base text-[#1A1A1A] mb-1">Synthesizing Feedback Dataset...</h3>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Gemini is digesting stakeholder sentiments, grouping recurring issues, and writing a concise strategic action report. Please wait a moment.
            </p>
          </div>
        ) : executiveSummary ? (
          <div className="flex-1 flex flex-col justify-between">
            {/* Scrollable Report Frame */}
            <div className="bg-[#F9F8F6] p-8 border border-[#E5E3DF] rounded-none max-h-[500px] overflow-y-auto mb-6">
              <MarkdownViewer markdown={executiveSummary} />
            </div>

            {/* Recalculate options */}
            <div className="flex items-center justify-between border-t border-[#E5E3DF] pt-4 gap-4">
              <p className="text-xs text-gray-400 italic font-serif">
                Summary compiled over {activeComments.length} active stakeholder comments.
              </p>
              <button
                onClick={onGenerateSummary}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-[10px] uppercase tracking-widest font-semibold rounded-none transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Refresh Analysis
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 border border-[#E5E3DF] text-gray-400 rounded-none flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-gray-400" />
            </div>
            <h3 className="font-serif italic text-lg text-[#1A1A1A] mb-1">No synthesis generated yet</h3>
            <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">
              Leverage the LLM model to summarize your parsed stakeholder comment dataset into structured themes, sentiment trends, and concrete action steps.
            </p>
            <button
              onClick={onGenerateSummary}
              className="px-6 py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-[10px] uppercase tracking-widest font-bold rounded-none transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Synthesize Executive Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
