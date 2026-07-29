import { CommentItem, DocumentSection } from "../types";

/**
 * Extracts all unique document references present across a list of comments.
 */
export function extractDocumentReferencesFromComments(comments: CommentItem[]): string[] {
  const refSet = new Set<string>();

  comments.forEach((c) => {
    if (c.documentReference && c.documentReference.trim()) {
      refSet.add(c.documentReference.trim());
    } else if (c.originalRowData) {
      // Check common column names in originalRowData if documentReference isn't set
      for (const [key, val] of Object.entries(c.originalRowData)) {
        const kLower = key.toLowerCase();
        if (
          (kLower.includes("doc") ||
            kLower.includes("section") ||
            kLower.includes("clause") ||
            kLower.includes("ref") ||
            kLower.includes("page") ||
            kLower.includes("article") ||
            kLower.includes("provision") ||
            kLower.includes("policy") ||
            kLower.includes("requirement")) &&
          val &&
          typeof val === "string" &&
          val.trim().length > 0 &&
          val.trim().length < 100
        ) {
          refSet.add(val.trim());
        }
      }
    }
  });

  return Array.from(refSet).sort();
}

/**
 * Auto-syncs document sections with references found in comments.
 * Ensures every reference present in comments has a DocumentSection entry in the store.
 */
export function syncDocumentSectionsWithComments(
  comments: CommentItem[],
  existingSections: DocumentSection[]
): DocumentSection[] {
  const discoveredRefs = extractDocumentReferencesFromComments(comments);
  const updatedList = [...existingSections];

  discoveredRefs.forEach((ref) => {
    const exists = updatedList.some(
      (sec) => sec.reference.toLowerCase().trim() === ref.toLowerCase().trim()
    );
    if (!exists) {
      updatedList.push({
        id: `doc_sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: ref,
        title: ref,
        excerptText: "",
        updatedAt: new Date().toLocaleDateString(),
      });
    }
  });

  return updatedList;
}

/**
 * Builds a prompt-ready markdown block of document context relevant to a set of comments.
 */
export function buildDocumentContextPromptBlock(
  comments: CommentItem[],
  sections?: DocumentSection[]
): string {
  let effectiveSections = sections;
  if (!effectiveSections) {
    const saved = localStorage.getItem("document_sections");
    if (saved) {
      try {
        effectiveSections = JSON.parse(saved);
      } catch (e) {}
    }
  }
  if (!effectiveSections || effectiveSections.length === 0) return "";

  // 1. Find all references in the provided comments
  const activeRefs = new Set<string>();
  comments.forEach((c) => {
    if (c.documentReference && c.documentReference.trim()) {
      activeRefs.add(c.documentReference.trim().toLowerCase());
    }
  });

  // 2. Filter sections matching active references OR marked as general/global context
  const matchedSections = effectiveSections.filter((sec) => {
    const isGlobal = sec.reference.toLowerCase().includes("global") || sec.reference.toLowerCase().includes("general");
    const isMatched = activeRefs.has(sec.reference.trim().toLowerCase());
    return (isMatched || isGlobal || activeRefs.size === 0) && sec.excerptText && sec.excerptText.trim().length > 0;
  });

  if (matchedSections.length === 0) {
    // If no exact match with excerpts, check if any section has text available
    const sectionsWithText = effectiveSections.filter((s) => s.excerptText && s.excerptText.trim().length > 0);
    if (sectionsWithText.length === 0) return "";
    
    return `\n--- REVIEWED MATERIAL / DOCUMENT CONTEXT ---
The dataset reviews draft materials. Document sections registered in the context store:
${sectionsWithText.map((s) => `\n### [DOCUMENT REFERENCE: ${s.reference}]\n${s.excerptText.trim()}`).join("\n\n")}\n`;
  }

  return `\n--- REVIEWED MATERIAL / DOCUMENT CONTEXT ---
The user feedback entries being analyzed specifically react to the following draft document sections/clauses:

${matchedSections.map((s) => `### [DOCUMENT REFERENCE: ${s.reference}]\n${s.excerptText.trim()}`).join("\n\n")}\n`;
}

/**
 * Automatically parses a multi-section document text (e.g. pasted policy or bill)
 * into individual document section models based on section headers like "Section 1", "Clause 2", etc.
 */
export function parsePastedDocumentToSections(
  fullDocumentText: string,
  existingSections: DocumentSection[]
): DocumentSection[] {
  if (!fullDocumentText || !fullDocumentText.trim()) return existingSections;

  // Split by common heading patterns e.g. "Section 1", "Clause 3", "Article IV", "Chapter 2", "## Section"
  const sectionHeaderRegex = /(?:^|\n)(?=(?:#+\s*|)(?:Section|Clause|Article|Chapter|Part|Clause|Page|Requirement|Policy)\s+\d+[a-z0-9\.\-:]*)/gi;
  
  const chunks = fullDocumentText.split(sectionHeaderRegex).map((c) => c.trim()).filter(Boolean);

  if (chunks.length <= 1) {
    // Single block, add as General/Global Document Context
    const updated = [...existingSections];
    const generalIdx = updated.findIndex((s) => s.reference.toLowerCase().includes("general") || s.reference.toLowerCase().includes("global"));
    if (generalIdx >= 0) {
      updated[generalIdx].excerptText = fullDocumentText.trim();
      updated[generalIdx].updatedAt = new Date().toLocaleDateString();
    } else {
      updated.unshift({
        id: `doc_sec_general_${Date.now()}`,
        reference: "General Draft Document Context",
        title: "Full Draft Document / Policy",
        excerptText: fullDocumentText.trim(),
        updatedAt: new Date().toLocaleDateString(),
      });
    }
    return updated;
  }

  const updatedSections = [...existingSections];

  chunks.forEach((chunk) => {
    const firstLineEnd = chunk.indexOf("\n");
    let refTitle = firstLineEnd > -1 ? chunk.substring(0, firstLineEnd).trim() : chunk.substring(0, 50).trim();
    refTitle = refTitle.replace(/^#+\s*/, ""); // Clean markdown headers

    const bodyText = firstLineEnd > -1 ? chunk.substring(firstLineEnd + 1).trim() : chunk.trim();

    const existingIdx = updatedSections.findIndex(
      (s) => s.reference.toLowerCase().trim() === refTitle.toLowerCase().trim()
    );

    if (existingIdx >= 0) {
      updatedSections[existingIdx].excerptText = bodyText;
      updatedSections[existingIdx].updatedAt = new Date().toLocaleDateString();
    } else {
      updatedSections.push({
        id: `doc_sec_parsed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        reference: refTitle,
        title: refTitle,
        excerptText: bodyText,
        updatedAt: new Date().toLocaleDateString(),
      });
    }
  });

  return updatedSections;
}
