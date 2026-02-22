import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExportFormat = "pptx" | "docx" | "pdf";

function markdownToHtml(markdown: string, title: string) {
  const lines = markdown.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      const level = line.match(/^#+/)?.[0].length || 1;
      htmlLines.push(`<h${level}>${escapeHtml(line.replace(/^#{1,6}\s+/, ""))}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      htmlLines.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (inList) {
      htmlLines.push("</ul>");
      inList = false;
    }
    htmlLines.push(`<p>${escapeHtml(line)}</p>`);
  }

  if (inList) htmlLines.push("</ul>");

  return `<!doctype html><html><head><meta charset=\"utf-8\"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;line-height:1.7;}h1,h2,h3{margin:16px 0 8px;}ul{padding-left:20px;}p{margin:8px 0;}</style></head><body><h1>${escapeHtml(title)}</h1>${htmlLines.join("\n")}</body></html>`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function buildExportFile(input: {
  title: string;
  markdown: string;
  format: ExportFormat;
  resourceType?: string | null;
}) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "k12-export-"));
  const baseName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const outputPath = path.join(tmpRoot, `${baseName}.${input.format}`);
  const scriptPath = path.join(process.cwd(), "server", "export.py");

  try {
    if (input.format === "pdf") {
      const htmlPath = path.join(tmpRoot, `${baseName}.html`);
      const html = markdownToHtml(input.markdown, input.title);
      await fs.writeFile(htmlPath, html, "utf8");
      await execFileAsync("libreoffice", ["--headless", "--convert-to", "pdf", "--outdir", tmpRoot, htmlPath], { timeout: 30000 });
    } else {
      await execFileAsync("python3", [scriptPath, input.format, input.title, input.markdown, outputPath, input.resourceType || ""], {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5,
      });
    }

    const finalPath = input.format === "pdf" ? path.join(tmpRoot, `${baseName}.pdf`) : outputPath;
    const buffer = await fs.readFile(finalPath);
    return { buffer, extension: input.format, cleanupDir: tmpRoot };
  } catch (error) {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupExportTempDir(dirPath: string) {
  await fs.rm(dirPath, { recursive: true, force: true });
}
