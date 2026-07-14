// Memory cache for high-dimensional vector embeddings to prevent React state bloating/lag,
// localStorage QuotaExceededError crashes, and out-of-memory errors on massive datasets.
const embeddingsCache = new Map<string, number[]>();

export function setCachedEmbedding(commentId: string, embedding: number[]) {
  if (commentId && Array.isArray(embedding)) {
    embeddingsCache.set(commentId, embedding);
  }
}

export function getCachedEmbedding(commentId: string): number[] | undefined {
  if (!commentId) return undefined;
  return embeddingsCache.get(commentId);
}

export function clearEmbeddingsCache() {
  embeddingsCache.clear();
}

export function loadEmbeddingsIntoCache(comments: { id: string; embedding?: number[] }[]) {
  for (const comment of comments) {
    if (comment.id && comment.embedding && Array.isArray(comment.embedding)) {
      setCachedEmbedding(comment.id, comment.embedding);
    }
  }
}
