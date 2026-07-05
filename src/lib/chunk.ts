// Naive word-count based chunking with overlap. Good enough for lecture
// notes/slides text; not token-exact but keeps chunks a consistent size.
export function chunkText(text: string, wordsPerChunk = 350, overlapWords = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = end - overlapWords;
  }
  return chunks;
}
