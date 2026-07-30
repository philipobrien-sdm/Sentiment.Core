import React, { useState, useMemo } from "react";
import { DocumentSection, CommentItem } from "../types";
import {
  FileText,
  X,
  Plus,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  BookOpen,
  FileCode2,
  Upload,
  Layers,
  MessageSquare,
  Save,
  Wand2
} from "lucide-react";
import {
  syncDocumentSectionsWithComments,
  parsePastedDocumentToSections,
  extractDocumentReferencesFromComments
} from "../utils/documentContext";

interface DocumentContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments: CommentItem[];
  sections?: DocumentSection[];
  documentSections?: DocumentSection[];
  onSaveSections?: (sections: DocumentSection[]) => void;
  onUpdateDocumentSections?: (sections: DocumentSection[]) => void;
  showToast: (message: string, type?: "success" | "info" | "error") => void;
}

export const DocumentContextModal: React.FC<DocumentContextModalProps> = ({
  isOpen,
  onClose,
  comments = [],
  sections,
  documentSections,
  onSaveSections,
  onUpdateDocumentSections,
  showToast,
}) => {
  if (!isOpen) return null;

  const activeSections = useMemo(() => {
    return sections || documentSections || [];
  }, [sections, documentSections]);

  const handleUpdate = (updated: DocumentSection[]) => {
    if (onSaveSections) onSaveSections(updated);
    if (onUpdateDocumentSections) onUpdateDocumentSections(updated);
  };

  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    activeSections[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [newRefInput, setNewRefInput] = useState("");
  const [pastedFullDoc, setPastedFullDoc] = useState("");
  const [isPastingFullDocOpen, setIsPastingFullDocOpen] = useState(false);

  // Selected section state
  const selectedSection = useMemo(() => {
    if (!activeSections || activeSections.length === 0) return null;
    return activeSections.find((s) => s.id === selectedSectionId) || activeSections[0] || null;
  }, [activeSections, selectedSectionId]);

  const [editingExcerpt, setEditingExcerpt] = useState<string>(selectedSection?.excerptText || "");

  // Update editing excerpt when selected section changes
  React.useEffect(() => {
    if (selectedSection) {
      setEditingExcerpt(selectedSection.excerptText || "");
    }
  }, [selectedSection?.id]);

  // Keep selectedSectionId valid when activeSections changes
  React.useEffect(() => {
    if (!selectedSectionId && activeSections.length > 0) {
      setSelectedSectionId(activeSections[0].id);
    }
  }, [activeSections, selectedSectionId]);

  // Count comments per reference
  const commentCountsByRef = useMemo(() => {
    const counts: Record<string, number> = {};
    comments.forEach((c) => {
      const ref = c.documentReference || c.originalRowData?.section || c.originalRowData?.clause || c.originalRowData?.doc_ref;
      if (ref) {
        const key = String(ref).trim().toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [comments]);

  // Comments matching selected section
  const commentsForSelectedSection = useMemo(() => {
    if (!selectedSection) return [];
    const targetRef = selectedSection.reference.trim().toLowerCase();
    return comments.filter((c) => {
      const ref = c.documentReference || c.originalRowData?.section || c.originalRowData?.clause || c.originalRowData?.doc_ref;
      return ref && String(ref).trim().toLowerCase() === targetRef;
    });
  }, [comments, selectedSection]);

  // Filtered sections list
  const filteredSections = useMemo(() => {
    return activeSections.filter(
      (s) =>
        s.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.excerptText.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeSections, searchQuery]);

  // Auto-Sync from CSV Comments
  const handleAutoExtractRefs = () => {
    const updated = syncDocumentSectionsWithComments(comments, activeSections);
    handleUpdate(updated);
    const addedCount = updated.length - activeSections.length;
    if (addedCount > 0) {
      showToast(`Discovered and added ${addedCount} document references from dataset!`, "success");
    } else {
      showToast("Document model is up to date with dataset references.", "info");
    }
  };

  // Add custom single section
  const handleAddCustomSection = () => {
    if (!newRefInput.trim()) return;
    const refName = newRefInput.trim();
    const exists = activeSections.some((s) => s.reference.toLowerCase() === refName.toLowerCase());
    if (exists) {
      showToast("A section with this reference name already exists.", "info");
      return;
    }

    const newSec: DocumentSection = {
      id: `doc_sec_${Date.now()}`,
      reference: refName,
      title: refName,
      excerptText: "",
      updatedAt: new Date().toLocaleDateString(),
    };

    const updated = [newSec, ...activeSections];
    handleUpdate(updated);
    setSelectedSectionId(newSec.id);
    setNewRefInput("");
    showToast(`Added document section "${refName}"`, "success");
  };

  // Save changes to current section
  const handleSaveCurrentExcerpt = () => {
    if (!selectedSection) return;
    const updated = activeSections.map((s) =>
      s.id === selectedSection.id
        ? { ...s, excerptText: editingExcerpt, updatedAt: new Date().toLocaleDateString() }
        : s
    );
    handleUpdate(updated);
    showToast(`Saved draft material context for "${selectedSection.reference}"`, "success");
  };

  // Delete section
  const handleDeleteSection = (id: string) => {
    const updated = activeSections.filter((s) => s.id !== id);
    handleUpdate(updated);
    if (selectedSectionId === id) {
      setSelectedSectionId(updated[0]?.id || "");
    }
    showToast("Deleted document section.", "info");
  };

  // Parse pasted full document
  const handleParsePastedFullDoc = () => {
    if (!pastedFullDoc.trim()) return;
    const updated = parsePastedDocumentToSections(pastedFullDoc, activeSections);
    handleUpdate(updated);
    setIsPastingFullDocOpen(false);
    setPastedFullDoc("");
    showToast("Processed document sections and updated context model!", "success");
  };

  const totalRefsCount = extractDocumentReferencesFromComments(comments).length;
  const sectionsWithContextCount = activeSections.filter((s) => s.excerptText && s.excerptText.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] border border-[#E5E3DF] shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header Bar */}
        <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif italic text-lg leading-none">Reviewed Material &amp; Document Context Model</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono mt-1">
                Link CSV Comment References to Draft Document Text &amp; Feed Exact Context to AI Syntheses
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Banner */}
        <div className="bg-[#F9F8F6] border-b border-[#E5E3DF] px-6 py-3 flex items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Document Sections:</span>
              <strong className="text-[#1A1A1A] font-bold">{activeSections.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Sections with Context Text:</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                {sectionsWithContextCount} / {activeSections.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">CSV References Discovered:</span>
              <strong className="text-amber-800 font-bold">{totalRefsCount}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoExtractRefs}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-[#E5E3DF] text-[#1A1A1A] text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-Discover CSV References</span>
            </button>

            <button
              onClick={() => setIsPastingFullDocOpen(true)}
              className="px-3 py-1.5 bg-[#2D1B0D] hover:bg-[#3D2513] text-amber-200 border border-amber-800 text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Paste Full Draft Document / Policy</span>
            </button>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Sections Sidebar */}
          <div className="w-80 bg-[#F9F8F6] border-r border-[#E5E3DF] flex flex-col shrink-0">
            
            {/* Search and Add input */}
            <div className="p-3 border-b border-[#E5E3DF] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter sections or clauses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E5E3DF] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="New section ref (e.g. Section 3.1)..."
                  value={newRefInput}
                  onChange={(e) => setNewRefInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomSection()}
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-[#E5E3DF] focus:outline-none focus:border-[#1A1A1A]"
                />
                <button
                  onClick={handleAddCustomSection}
                  className="p-1 bg-[#1A1A1A] text-white hover:bg-[#1A1A1A]/80 cursor-pointer transition-colors"
                  title="Add Section"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sections List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E5E3DF]">
              {filteredSections.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 font-mono">
                  No document sections found. Click "Auto-Discover" or add a custom reference above.
                </div>
              ) : (
                filteredSections.map((sec) => {
                  const isSelected = selectedSection?.id === sec.id;
                  const cCount = commentCountsByRef[sec.reference.trim().toLowerCase()] || 0;
                  const hasText = sec.excerptText && sec.excerptText.trim().length > 0;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                        isSelected ? "bg-white border-l-4 border-l-amber-600 shadow-2xs" : "hover:bg-white/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className={`w-3.5 h-3.5 shrink-0 ${hasText ? "text-emerald-600" : "text-gray-400"}`} />
                          <h4 className="text-xs font-bold text-[#1A1A1A] truncate">{sec.reference}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                          <span>{cCount} feedback items</span>
                          <span>•</span>
                          <span className={hasText ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                            {hasText ? "Text Loaded" : "Needs Text"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSection(sec.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#A13D2D] text-gray-400 transition-opacity"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Text Editor & Comments Inspector */}
          <div className="flex-1 flex flex-col bg-white overflow-y-auto p-6">
            {selectedSection ? (
              <div className="space-y-6 max-w-4xl mx-auto w-full">
                
                {/* Selected Section Header */}
                <div className="border-b border-[#E5E3DF] pb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                        Document Reference
                      </span>
                      <span className="text-xs font-mono text-gray-400">ID: {selectedSection.id}</span>
                    </div>
                    <h3 className="font-serif italic text-2xl text-[#1A1A1A]">{selectedSection.reference}</h3>
                    {selectedSection.updatedAt && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">Last updated: {selectedSection.updatedAt}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveCurrentExcerpt}
                      className="px-4 py-2 bg-[#4A6741] hover:bg-[#3d5535] text-white text-xs font-mono uppercase tracking-wider font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Context Text</span>
                    </button>
                  </div>
                </div>

                {/* Text Editor Card */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] font-mono flex items-center gap-1.5">
                      <FileCode2 className="w-4 h-4 text-amber-600" />
                      Copy/Paste Draft Document or Clause Text
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {editingExcerpt.length} characters
                    </span>
                  </div>

                  <textarea
                    rows={10}
                    value={editingExcerpt}
                    onChange={(e) => setEditingExcerpt(e.target.value)}
                    placeholder="Paste the exact text of this document section or clause here (e.g., 'Clause 3.1: All safety equipment must undergo bi-weekly calibration...'). When AI syntheses are run on feedback citing this reference, this text will be provided directly to the model!"
                    className="w-full p-4 border border-[#E5E3DF] focus:border-[#1A1A1A] focus:outline-none font-mono text-xs text-[#1A1A1A] bg-[#FAF9F6] leading-relaxed shadow-inner"
                  />
                  <p className="text-[11px] text-gray-500 font-sans">
                    💡 <strong>Pro-Tip:</strong> Providing the exact draft text ensures that LLM Executive Syntheses analyze customer feedback in direct comparison with what the document actually proposes!
                  </p>
                </div>

                {/* Matching Comments Preview */}
                <div className="border-t border-[#E5E3DF] pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] font-mono flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      Matching Feedback Items Citing "{selectedSection.reference}" ({commentsForSelectedSection.length})
                    </h4>
                  </div>

                  {commentsForSelectedSection.length === 0 ? (
                    <div className="bg-[#F9F8F6] p-4 text-center border border-[#E5E3DF] text-xs text-gray-500 italic">
                      No feedback comments in the current dataset explicitly cite this document reference yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {commentsForSelectedSection.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-3 bg-[#F9F8F6] border border-[#E5E3DF] text-xs space-y-1 hover:bg-white transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-gray-500">
                            <span className="font-bold text-[#1A1A1A]">
                              Row #{item.csvRowIndex || idx + 1} {item.organizationName ? `• ${item.organizationName}` : ""}
                            </span>
                            <span className={`capitalize font-bold px-1.5 py-0.5 ${
                              item.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-800' :
                              item.sentiment === 'negative' ? 'bg-rose-100 text-rose-800' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {item.sentiment}
                            </span>
                          </div>
                          <p className="text-[#1A1A1A] font-serif leading-relaxed italic">"{item.text}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
                <BookOpen className="w-12 h-12 text-gray-300" />
                <h4 className="font-serif italic text-lg text-[#1A1A1A]">No Document Section Selected</h4>
                <p className="text-xs max-w-sm text-gray-500">
                  Select a section from the sidebar or click "Auto-Discover CSV References" above to populate the document model.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="bg-[#F9F8F6] border-t border-[#E5E3DF] px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full" />
            <span>Document context automatically persists in session state and propagates to offline HTML exports.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white font-mono text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-colors"
          >
            Close Workspace
          </button>
        </div>

      </div>

      {/* Paste Full Document Modal Overlay */}
      {isPastingFullDocOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl border border-[#E5E3DF] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E3DF] pb-3">
              <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Paste Draft Document or Policy Text
              </h3>
              <button
                onClick={() => setIsPastingFullDocOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-[#1A1A1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Paste the full text of your draft policy, proposal, or standard document below. The engine will automatically detect section headings (e.g. <em>Section 1, Clause 3, Article IV</em>) or register the entire draft as general context for AI synthesis.
            </p>

            <textarea
              rows={12}
              value={pastedFullDoc}
              onChange={(e) => setPastedFullDoc(e.target.value)}
              placeholder="Paste draft document content here..."
              className="w-full p-3 border border-[#E5E3DF] font-mono text-xs focus:outline-none focus:border-[#1A1A1A] bg-[#FAF9F6]"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsPastingFullDocOpen(false)}
                className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePastedFullDoc}
                className="px-4 py-2 bg-[#2D1B0D] hover:bg-[#3D2513] text-amber-200 text-xs font-mono uppercase font-bold cursor-pointer"
              >
                Process &amp; Update Document Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
