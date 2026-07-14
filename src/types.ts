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
}

export interface DuplicatePair {
  itemA: CommentItem;
  itemB: CommentItem;
  similarity: number;
}

export interface FilterState {
  sentiments: ('positive' | 'neutral' | 'negative')[];
  topics: string[];
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
