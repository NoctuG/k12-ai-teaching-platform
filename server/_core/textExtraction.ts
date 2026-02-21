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

function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Extract text content from a file stored in S3.
 * Supports PDF, DOCX, and plain text files.
 */
export async function extractTextFromFile(
  fileKey: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const buffer = await fetchFileFromS3(fileKey);

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return extractDocxText(buffer);
  }

  if (
    mimeType === "application/msword" ||
    fileName.endsWith(".doc")
  ) {
    // .doc format is not well supported; attempt plain text extraction
    return extractPlainText(buffer);
  }

  if (
    mimeType.startsWith("text/") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  ) {
    return extractPlainText(buffer);
  }

  // For unsupported types (images, etc.), return empty
  return "";
}

/**
 * Extract text directly from a Buffer (used during upload when we already have the data).
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return extractDocxText(buffer);
  }

  if (
    mimeType === "application/msword" ||
    fileName.endsWith(".doc")
  ) {
    return extractPlainText(buffer);
  }

  if (
    mimeType.startsWith("text/") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  ) {
    return extractPlainText(buffer);
  }

  return "";
}
