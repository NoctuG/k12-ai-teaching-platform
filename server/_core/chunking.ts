export interface TextChunk {
  index: number;
  content: string;
  charCount: number;
}

const DEFAULT_CHUNK_SIZE = 800; // characters per chunk
const DEFAULT_CHUNK_OVERLAP = 100; // overlap between chunks

/**
 * Split text into chunks with overlap for RAG retrieval.
 * Attempts to split at paragraph/sentence boundaries when possible.
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanedText = text.replace(/\n{3,}/g, "\n\n").trim();

  if (cleanedText.length <= chunkSize) {
    return [{
      index: 0,
      content: cleanedText,
      charCount: cleanedText.length,
    }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < cleanedText.length) {
    let end = Math.min(start + chunkSize, cleanedText.length);

    // If not at the end of text, try to find a good break point
    if (end < cleanedText.length) {
      const segment = cleanedText.slice(start, end);

      // Try paragraph break first
      const lastParagraph = segment.lastIndexOf("\n\n");
      if (lastParagraph > chunkSize * 0.3) {
        end = start + lastParagraph + 2;
      } else {
        // Try sentence break
        const lastSentence = Math.max(
          segment.lastIndexOf("。"),
          segment.lastIndexOf("！"),
          segment.lastIndexOf("？"),
          segment.lastIndexOf(". "),
          segment.lastIndexOf("! "),
          segment.lastIndexOf("? "),
        );
        if (lastSentence > chunkSize * 0.3) {
          end = start + lastSentence + 1;
        }
      }
    }

    const content = cleanedText.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        index,
        content,
        charCount: content.length,
      });
      index++;
    }

    // Move start forward, accounting for overlap
    start = end - overlap;
    if (start <= (chunks.length > 0 ? end - content.length : 0)) {
      // Prevent infinite loop
      start = end;
    }
  }

  return chunks;
}
