/**
 * Markdown block parser and serializer for the Canvas editor.
 *
 * Splits markdown content into discrete editable blocks and
 * serializes them back to a markdown string.
 */

export type BlockType = "heading" | "paragraph" | "list" | "code" | "table" | "blockquote" | "hr";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  /** Heading level 1-6 (only for heading blocks) */
  level?: number;
}

let nextId = 1;

function makeId(): string {
  return `block-${nextId++}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reset the ID counter (useful for tests).
 */
export function resetIdCounter() {
  nextId = 1;
}

/**
 * Parse a markdown string into an ordered array of blocks.
 */
export function parseMarkdown(md: string): Block[] {
  if (!md || !md.trim()) return [];

  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines between blocks
    if (line.trim() === "") {
      i++;
      continue;
    }

    // --- Horizontal rule ---
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ id: makeId(), type: "hr", content: "---" });
      i++;
      continue;
    }

    // --- Heading ---
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      blocks.push({
        id: makeId(),
        type: "heading",
        content: headingMatch[2],
        level: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // --- Code block (fenced) ---
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length) {
        codeLines.push(lines[i]);
        if (lines[i].trimStart().startsWith("```") && codeLines.length > 1) {
          i++;
          break;
        }
        i++;
      }
      blocks.push({ id: makeId(), type: "code", content: codeLines.join("\n") });
      continue;
    }

    // --- Table ---
    if (line.includes("|") && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1])) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: makeId(), type: "table", content: tableLines.join("\n") });
      continue;
    }

    // --- Blockquote ---
    if (line.trimStart().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trimStart().startsWith(">") || (lines[i].trim() !== "" && quoteLines.length > 0 && !lines[i].trimStart().startsWith("#")))) {
        if (!lines[i].trimStart().startsWith(">") && lines[i].trim() === "") break;
        quoteLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: makeId(), type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // --- List (ordered and unordered) ---
    if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        // Continue if it's a list item or indented continuation or empty line between items
        if (/^(\s*[-*+]|\s*\d+\.)\s/.test(l)) {
          listLines.push(l);
          i++;
        } else if (l.trim() === "" && i + 1 < lines.length && /^(\s*[-*+]|\s*\d+\.)\s/.test(lines[i + 1])) {
          listLines.push(l);
          i++;
        } else if (l.match(/^\s{2,}/) && listLines.length > 0) {
          // Indented continuation line
          listLines.push(l);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ id: makeId(), type: "list", content: listLines.join("\n") });
      continue;
    }

    // --- Paragraph (default) ---
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      // Break if next line starts a different block type
      const nextLine = lines[i];
      if (
        /^#{1,6}\s/.test(nextLine) ||
        nextLine.trimStart().startsWith("```") ||
        nextLine.trimStart().startsWith(">") ||
        /^(\s*[-*+]|\s*\d+\.)\s/.test(nextLine) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(nextLine.trim())
      ) {
        if (paraLines.length > 0) break;
      }
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ id: makeId(), type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return blocks;
}

/**
 * Serialize an array of blocks back to a markdown string.
 */
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level || 1)} ${block.content}`;
        case "paragraph":
          return block.content;
        case "list":
          return block.content;
        case "code":
          return block.content;
        case "table":
          return block.content;
        case "blockquote":
          return block.content;
        case "hr":
          return "---";
        default:
          return block.content;
      }
    })
    .join("\n\n");
}

/**
 * Create a new empty block of the given type.
 */
export function createEmptyBlock(type: BlockType): Block {
  const defaults: Record<BlockType, string> = {
    heading: "新标题",
    paragraph: "在此输入内容...",
    list: "- 列表项",
    code: "```\n\n```",
    table: "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |",
    blockquote: "> 引用内容",
    hr: "---",
  };
  return {
    id: makeId(),
    type,
    content: defaults[type],
    level: type === "heading" ? 2 : undefined,
  };
}
