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

export interface PageChunk {
  content: string;
  pageNumber: number;
}

// Chunks each page's text independently so every chunk can be attributed to
// exactly one page, which is what lets a chunk be linked to that page's images.
export function chunkPages(
  pages: { num: number; text: string }[],
  wordsPerChunk = 350,
  overlapWords = 50
): PageChunk[] {
  const result: PageChunk[] = [];
  for (const page of pages) {
    for (const content of chunkText(page.text, wordsPerChunk, overlapWords)) {
      result.push({ content, pageNumber: page.num });
    }
  }
  return result;
}
