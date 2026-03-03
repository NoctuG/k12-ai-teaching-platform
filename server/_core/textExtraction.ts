import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./env";

function getS3Client() {
  return new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || undefined,
    credentials: {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey,
    },
    forcePathStyle: ENV.s3ForcePathStyle,
  });
}

async function fetchFileFromS3(fileKey: string): Promise<Buffer> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: fileKey,
  });

  const response = await client.send(command);
  if (!response.Body) {
    throw new Error("Empty response body from S3");
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    lines.push(`[${sheetName}]`);
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(csv);
  }
  return lines.join("\n");
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  // PPTX is a ZIP containing XML slides. Extract text from slide XML files.
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const lines: string[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    // Extract text content from XML tags like <a:t>text</a:t>
    const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideTexts = textMatches.map(m => m.replace(/<[^>]+>/g, ""));
      lines.push(slideTexts.join(" "));
    }
  }

  return lines.join("\n");
}

function extractHtmlText(buffer: Buffer): string {
  const html = buffer.toString("utf-8");
  // Strip HTML tags and decode common entities
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

function matchesType(
  mimeType: string,
  fileName: string,
  mimeTypes: string[],
  extensions: string[]
): boolean {
  if (mimeTypes.some(m => mimeType === m)) return true;
  const lower = fileName.toLowerCase();
  return extensions.some(ext => lower.endsWith(ext));
}

async function extractFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  // PDF
  if (matchesType(mimeType, fileName, ["application/pdf"], [".pdf"])) {
    return extractPdfText(buffer);
  }

  // DOCX
  if (
    matchesType(mimeType, fileName,
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      [".docx"])
  ) {
    return extractDocxText(buffer);
  }

  // DOC (limited support)
  if (matchesType(mimeType, fileName, ["application/msword"], [".doc"])) {
    return extractPlainText(buffer);
  }

  // XLSX / XLS
  if (
    matchesType(mimeType, fileName,
      [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ],
      [".xlsx", ".xls"])
  ) {
    return extractXlsxText(buffer);
  }

  // PPTX
  if (
    matchesType(mimeType, fileName,
      ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      [".pptx"])
  ) {
    return extractPptxText(buffer);
  }

  // PPT (legacy, limited support)
  if (matchesType(mimeType, fileName, ["application/vnd.ms-powerpoint"], [".ppt"])) {
    return extractPlainText(buffer);
  }

  // CSV
  if (matchesType(mimeType, fileName, ["text/csv"], [".csv"])) {
    return extractPlainText(buffer);
  }

  // HTML
  if (matchesType(mimeType, fileName, ["text/html"], [".html", ".htm"])) {
    return extractHtmlText(buffer);
  }

  // Plain text, Markdown, JSON, XML, YAML, RTF, etc.
  if (
    mimeType.startsWith("text/") ||
    matchesType(mimeType, fileName,
      ["application/json", "application/xml", "application/rtf", "application/x-yaml"],
      [".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".rtf"])
  ) {
    return extractPlainText(buffer);
  }

  // Unsupported types (images, etc.)
  return "";
}

/**
 * Extract text content from a file stored in S3.
 * Supports PDF, DOCX, DOC, XLSX, XLS, PPTX, CSV, HTML, Markdown,
 * JSON, XML, YAML, RTF, and plain text files.
 */
export async function extractTextFromFile(
  fileKey: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const buffer = await fetchFileFromS3(fileKey);
  return extractFromBuffer(buffer, mimeType, fileName);
}

/**
 * Extract text directly from a Buffer (used during upload when we already have the data).
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  return extractFromBuffer(buffer, mimeType, fileName);
}
