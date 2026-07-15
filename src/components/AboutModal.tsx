import React, { useState } from "react";
import { 
  X, Info, ArrowLeft, ArrowRight, Sparkles, Database, 
  Layers, Search, FileText, CheckCircle2, ChevronRight, HelpCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Custom interactive comparison sentences state
  const [sentencePair, setSentencePair] = useState(0);

  const sentences = [
    {
      group: "System Performance",
      a: "The loading times are incredibly sluggish.",
      b: "The interface feels laggy and slow to respond.",
      similarity: 0.88,
      explanation: "Zero shared descriptive keywords, yet both indicate severe performance degradation. Vector math bridges the lexical gap."
    },
    {
      group: "Price / Value Feedback",
      a: "It costs too much for small businesses.",
      b: "The monthly subscription is quite expensive.",
      similarity: 0.84,
      explanation: "Excel filters for 'costs' or 'expensive' separately miss the opposite comment. Embeddings place them in the exact same economic coordinate block."
    },
    {
      group: "Usability / Layout Issues",
      a: "I can never find where the buttons are hidden.",
      b: "The new layout is highly counter-intuitive.",
      similarity: 0.81,
      explanation: "One talks about button locations; the other about layouts. Both map to the 'UI Design Friction' semantic neighborhood."
    }
  ];

  const slides = [
    {
      title: "Introducing Sentiment.Core",
      tagline: "Unlocking Insights That Hide from Traditional Spreadsheets",
      icon: <Layers className="w-8 h-8 text-[#4A6741]" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            Analyzing stakeholder and customer feedback at scale has always been slow. Teams usually dump thousands of reviews into Excel, filter by keyword (like <code className="bg-gray-100 text-[#A13D2D] px-1 font-mono">"slow"</code>), and hope they caught everything.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="border border-[#E5E3DF] p-4 bg-[#F9F8F6]/50">
              <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-gray-400 block mb-1">Traditional Excel Method</span>
              <h5 className="font-serif italic text-xs font-semibold text-[#1A1A1A] mb-2">Lexical Keyword Matching</h5>
              <ul className="space-y-1.5 text-[11px] text-gray-500">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#A13D2D] font-bold">❌</span>
                  <span>Misses synonyms (sluggish, laggy, delayed)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#A13D2D] font-bold">❌</span>
                  <span>Misses context or complex phrasing</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#A13D2D] font-bold">❌</span>
                  <span>Results in flat, unorganized lists of text</span>
                </li>
              </ul>
            </div>

            <div className="border border-[#4A6741]/20 p-4 bg-[#4A6741]/5">
              <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-[#4A6741] block mb-1">Sentiment.Core Method</span>
              <h5 className="font-serif italic text-xs font-semibold text-[#1A1A1A] mb-2">Semantic AI Projections</h5>
              <ul className="space-y-1.5 text-[11px] text-gray-600">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#4A6741] font-bold">✔</span>
                  <span>Understands deep meaning and intent</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#4A6741] font-bold">✔</span>
                  <span>Groups similar topics automatically</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#4A6741] font-bold">✔</span>
                  <span>Flattens multidimensional data into intuitive visual maps</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "The Engine: What is a Vector Embedding?",
      tagline: "Translating Human Nuance into High-Dimensional Geometry",
      icon: <Database className="w-8 h-8 text-[#4A6741]" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            To a computer, text is just letters. To understand <em>meaning</em>, an AI model converts words into a dense numerical array called an <strong>Embedding Vector</strong>.
          </p>

          <div className="bg-[#1A1A1A] text-white p-4 font-mono text-[11px] space-y-3 border-l-4 border-[#4A6741]">
            <div className="flex justify-between text-gray-400 text-[10px] uppercase pb-1 border-b border-white/10">
              <span>Plain Human Feedback</span>
              <span>1,536-Dimensional Math Array (Vector)</span>
            </div>
            
            <div className="space-y-2 leading-normal">
              <div>
                <span className="text-gray-400">"The app is laggy"</span>
                <span className="text-[#4A6741] font-bold mx-2">➔</span>
                <span className="text-green-300">[ 0.1241, -0.4502, 0.8911, -0.0125, 0.3218, ... ]</span>
              </div>
              <div className="border-t border-white/5 pt-2">
                <span className="text-gray-400">"Interface is slow"</span>
                <span className="text-[#4A6741] font-bold mx-2">➔</span>
                <span className="text-green-300">[ 0.1239, -0.4498, 0.8899, -0.0131, 0.3220, ... ]</span>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-xs leading-relaxed">
            Think of each number in the array as a coordinate representing a conceptual trait (e.g. <em>speed</em>, <em>user interface</em>, <em>frustration</em>). Comments with similar meanings will have numbers that align closely, placing them near each other in geometric space.
          </p>
        </div>
      )
    },
    {
      title: "Interactive Demo: Semantic Equivalence",
      tagline: "See Vector Similarity in Action with Zero Shared Keywords",
      icon: <Sparkles className="w-8 h-8 text-[#4A6741]" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            Select a comparison category below to see how our vectors detect similarity even when the words used are entirely different.
          </p>

          {/* Selector Tabs */}
          <div className="flex border border-[#E5E3DF] p-1 bg-[#F9F8F6]">
            {sentences.map((pair, idx) => (
              <button
                key={idx}
                onClick={() => setSentencePair(idx)}
                className={`flex-1 py-1 px-2 text-[10px] sm:text-xs font-semibold cursor-pointer uppercase transition-colors ${
                  sentencePair === idx 
                    ? "bg-[#1A1A1A] text-white" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {pair.group}
              </button>
            ))}
          </div>

          {/* Interactive Calculation Visualization */}
          <div className="border border-[#E5E3DF] p-4 bg-[#F9F8F6]/20 space-y-3.5">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] uppercase font-mono bg-amber-100 text-amber-800 px-1 py-0.5 mt-0.5">Phrase A</span>
                <p className="text-xs font-medium text-gray-800 italic">"{sentences[sentencePair].a}"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[10px] uppercase font-mono bg-blue-100 text-blue-800 px-1 py-0.5 mt-0.5">Phrase B</span>
                <p className="text-xs font-medium text-gray-800 italic">"{sentences[sentencePair].b}"</p>
              </div>
            </div>

            {/* Simulated Vector Graph Comparison */}
            <div className="bg-[#1A1A1A] p-3 text-white rounded-none font-mono text-[10px] space-y-2">
              <div className="flex justify-between items-center text-gray-400 border-b border-white/10 pb-1.5 mb-1">
                <span>VECTOR OVERLAP CORRELATION</span>
                <span className="text-green-400 font-bold">MATCH FOUND</span>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-gray-400 text-right truncate">Vec_A:</span>
                  <div className="flex-1 bg-white/10 h-3 flex overflow-hidden">
                    <div className="bg-amber-400 h-full w-[85%]" />
                    <div className="bg-amber-400/30 h-full w-[15%]" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-gray-400 text-right truncate">Vec_B:</span>
                  <div className="flex-1 bg-white/10 h-3 flex overflow-hidden">
                    <div className="bg-blue-400 h-full w-[81%]" />
                    <div className="bg-blue-400/30 h-full w-[19%]" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                <span className="text-gray-400">Cosine Similarity Score:</span>
                <span className="text-green-400 font-bold text-xs">{(sentences[sentencePair].similarity * 100).toFixed(0)}% Match</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 leading-normal">
              <strong>Why this works:</strong> {sentences[sentencePair].explanation}
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Unmatched Operational Scale",
      tagline: "What Excel Filters Simply Can't Achieve",
      icon: <Search className="w-8 h-8 text-[#4A6741]" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
            By grouping thoughts rather than exact keywords, Sentiment.Core elevates stakeholder review into an automated strategic advantage:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="border border-[#E5E3DF] p-3 text-center space-y-1">
              <div className="text-[#4A6741] font-bold text-lg">Instant Cluster</div>
              <p className="text-[11px] text-gray-500">
                Maps thousands of multi-sentence reviews into distinct topical "islands" instantly.
              </p>
            </div>
            <div className="border border-[#E5E3DF] p-3 text-center space-y-1">
              <div className="text-[#4A6741] font-bold text-lg">Conflict Review</div>
              <p className="text-[11px] text-gray-500">
                Contrast opposing sentiment blocks (Positive vs. Negative) on the exact same topic instantly.
              </p>
            </div>
            <div className="border border-[#E5E3DF] p-3 text-center space-y-1">
              <div className="text-[#4A6741] font-bold text-lg">AI Synthesis</div>
              <p className="text-[11px] text-gray-500">
                Leverage local LLMs to generate strategic action items based on vector clusters, not hearsay.
              </p>
            </div>
          </div>

          <div className="bg-[#F9F8F6] p-4 text-xs text-gray-600 border border-[#E5E3DF] space-y-1.5">
            <span className="font-semibold text-[#1A1A1A] block">💡 Ready to explore?</span>
            <p className="leading-relaxed text-[11px]">
              Use the **Similarity Plot** tab to visually drag-select adjacent nodes, click the **Comments List** to contrast divergent stakeholder views, or configure a local LLM in **Settings** to run custom critiques.
            </p>
          </div>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="about_mechanism_modal"
    >
      <div 
        className="bg-white border border-[#E5E3DF] w-full max-w-2xl flex flex-col shadow-2xl relative"
        style={{ minHeight: "500px" }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E3DF] bg-[#F9F8F6]">
          <div className="flex items-center gap-3">
            {slides[currentSlide].icon}
            <div>
              <span className="text-[9px] uppercase font-mono tracking-widest text-[#4A6741] font-bold block mb-0.5">
                Slide {currentSlide + 1} of {slides.length} • Concept Explainer
              </span>
              <h3 className="font-serif italic text-lg sm:text-xl text-[#1A1A1A]">
                {slides[currentSlide].title}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-[#1A1A1A] p-1.5 cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle / Tagline bar */}
        <div className="px-6 py-2 border-b border-[#E5E3DF] bg-[#F9F8F6]/40 text-[10px] sm:text-xs text-gray-500 font-sans font-medium tracking-wide">
          {slides[currentSlide].tagline}
        </div>

        {/* Dynamic slide container */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: "400px" }}>
          {slides[currentSlide].content}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-[#E5E3DF] bg-[#F9F8F6]/80 flex items-center justify-between">
          
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                  idx === currentSlide 
                    ? "bg-[#4A6741] scale-125" 
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="px-3.5 py-1.5 border border-[#E5E3DF] hover:border-[#1A1A1A] text-gray-700 bg-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {currentSlide < slides.length - 1 ? (
              <button
                onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                className="px-4 py-1.5 bg-[#4A6741] hover:bg-[#3D5535] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>Start Exploring</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
