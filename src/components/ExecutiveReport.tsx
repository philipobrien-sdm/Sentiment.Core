import React from "react";
import { CommentItem } from "../types";
import { Sparkles, FileText, Download, Loader2, ArrowRight } from "lucide-react";

interface ExecutiveReportProps {
  comments: CommentItem[];
  executiveSummary: string | null;
  isSummarizing: boolean;
  onGenerateSummary: () => void;
  apiMode: 'live' | 'demo';
}

// A beautiful, secure client-side Markdown formatter for clean rendering without external package overhead
const MarkdownViewer: React.FC<{ markdown: string }> = ({ markdown }) => {
  const lines = markdown.split("\n");
  
  return (
    <div className="space-y-4 text-[#1A1A1A] leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Headers (H1, H2, H3)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-base font-serif italic text-[#1A1A1A] pt-4 pb-1 flex items-center gap-2 border-b border-dashed border-[#E5E3DF] font-semibold">
              {trimmed.substring(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-lg font-serif italic text-[#1A1A1A] pt-5 pb-1.5 flex items-center gap-2 border-b border-[#E5E3DF] font-semibold">
              {trimmed.substring(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-xl font-serif italic font-semibold text-[#1A1A1A] pt-6 pb-2 border-b border-2 border-[#1A1A1A] mb-4">
              {trimmed.substring(2)}
            </h2>
          );
        }

        // Unordered list items
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <li key={idx} className="ml-5 list-disc pl-1 text-gray-700 my-1">
              {renderInlineBold(content)}
            </li>
          );
        }

        // Ordered list items (e.g., "1. ")
        const numberedMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex gap-2.5 my-2.5 items-start">
              <span className="font-mono text-[10px] bg-[#F9F8F6] border border-[#E5E3DF] text-[#1A1A1A] font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 rounded-none">
                {numberedMatch[1]}
              </span>
              <p className="flex-1 text-gray-700">{renderInlineBold(numberedMatch[2])}</p>
            </div>
          );
        }

        // Blank line
        if (trimmed === "") {
          return <div key={idx} className="h-2" />;
        }

        // Default paragraph
        return (
          <p key={idx} className="my-1.5 leading-relaxed text-xs">
            {renderInlineBold(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// Simple inline helper to bold **text** in responses
function renderInlineBold(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, index) => {
    // Every odd part is captured between stars
    if (index % 2 === 1) {
      return <strong key={index} className="font-semibold text-[#1A1A1A]">{part}</strong>;
    }
    return part;
  });
}

export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({
  comments,
  executiveSummary,
  isSummarizing,
  onGenerateSummary,
  apiMode,
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
