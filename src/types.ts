export interface CommentItem {
  id: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topic: string;
  embedding?: number[];
  x: number; // 2D projection similarity coordinate X (-1 to 1)
  y: number; // 2D projection similarity coordinate Y (-1 to 1)
  isDuplicate?: boolean;
  duplicateOfId?: string;
  similarityScore?: number;
  isArchived?: boolean;
  timestamp?: string;
  csvRowIndex?: number; // 1-based index of row in CSV
  originalRowData?: Record<string, string>; // Holds all columns from the uploaded CSV
  originalId?: string;
  organizationName?: string;
  documentReference?: string; // Reference to reviewed material (e.g. "Section 3.1", "Clause 4.2", "Page 12")
  clusterConfidence?: number; // Similarity/Confidence score for primary cluster assignment (0.0 to 1.0)
  secondaryTopics?: { topic: string; confidence: number }[]; // Secondary cluster matches >= 50%
  proposedResponse?: string; // Proposed official or AI response to this feedback comment
  proposedResponseBy?: string; // Author/Role of proposed response (e.g. "Policy Analyst", "LLM Assistant")
  proposedResponseAt?: string; // Timestamp when proposed response was drafted or updated
}

export interface DocumentSection {
  id: string;
  reference: string; // Document reference name or clause (e.g., "Section 3.2: Safety Protocols")
  title?: string;
  excerptText: string; // Copy-pasted or uploaded text content of this section
  updatedAt?: string;
}

export interface DuplicateGroup {
  id: string;
  originalComment: CommentItem;
  duplicates: {
    comment: CommentItem;
    similarity: number;
  }[];
}

export interface LlmSettings {
  baseUrl: string;
  modelName: string;
  embeddingUrl: string;
  embeddingModel: string;
  apiKey: string;
  useCustomEmbedding: boolean; // false = use built-in heuristic embeddings, true = use custom local embeddings endpoint
  customPersona?: string; // custom instructions or personality profile (e.g. "you are a senior policy analyst")
  datasetContext?: string; // initial context describing the loaded CSV file
}

export interface DuplicatePair {
  itemA: CommentItem;
  itemB: CommentItem;
  similarity: number;
}

export interface FilterState {
  sentiments: ('positive' | 'neutral' | 'negative')[];
  topics: string[];
  organizations: string[];
  searchQuery: string;
  showDuplicatesOnly: boolean;
  similarityThreshold: number;
}

export interface AnalysisState {
  comments: CommentItem[];
  selectedCommentId: string | null;
  filters: FilterState;
  executiveSummary: string | null;
  isSummarizing: boolean;
  isIndexing: boolean;
  indexingProgress: number;
  apiMode: 'live' | 'demo';
}

export type StakeholderQuadrant = 'key_players' | 'keep_satisfied' | 'keep_informed' | 'monitor';

export interface StakeholderMapping {
  organizationName: string;
  interest: number; // 1.0 (Low) to 5.0 (High)
  influence: number; // 1.0 (Low) to 5.0 (High)
  quadrant: StakeholderQuadrant;
  notes?: string;
  updatedAt?: string;
}

export interface QuadrantInfo {
  quadrant: StakeholderQuadrant;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  priorityWeight: number; // multiplier for report prioritization
}

export function getQuadrantInfo(influence: number = 3, interest: number = 3): QuadrantInfo {
  const isHighInfluence = influence >= 3.0;
  const isHighInterest = interest >= 3.0;

  if (isHighInfluence && isHighInterest) {
    return {
      quadrant: 'key_players',
      label: 'Key Players (Manage Closely)',
      shortLabel: 'Key Player',
      description: 'High Influence & High Interest: Prioritize their feedback heavily in review evaluation and action reports.',
      color: 'text-amber-900',
      bgColor: 'bg-amber-100/90',
      borderColor: 'border-amber-400',
      icon: '👑',
      priorityWeight: 2.5
    };
  } else if (isHighInfluence && !isHighInterest) {
    return {
      quadrant: 'keep_satisfied',
      label: 'Keep Satisfied (High Influence)',
      shortLabel: 'Keep Satisfied',
      description: 'High Influence & Low Interest: Satisfy key compliance and strategic demands to prevent opposition.',
      color: 'text-blue-900',
      bgColor: 'bg-blue-100/90',
      borderColor: 'border-blue-400',
      icon: '🛡️',
      priorityWeight: 1.8
    };
  } else if (!isHighInfluence && isHighInterest) {
    return {
      quadrant: 'keep_informed',
      label: 'Keep Informed (High Interest)',
      shortLabel: 'Keep Informed',
      description: 'Low Influence & High Interest: Passionate, detailed end-user feedback requiring active communication.',
      color: 'text-emerald-900',
      bgColor: 'bg-emerald-100/90',
      borderColor: 'border-emerald-400',
      icon: '📢',
      priorityWeight: 1.4
    };
  } else {
    return {
      quadrant: 'monitor',
      label: 'Monitor (Low Priority)',
      shortLabel: 'Monitor',
      description: 'Low Influence & Low Interest: General feedback segment, track with minimal routine effort.',
      color: 'text-gray-800',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      icon: '👁️',
      priorityWeight: 1.0
    };
  }
}

