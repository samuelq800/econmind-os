export type WebReaderPage = {
  number: number;
  paragraphs: string[];
};

type TextItem = { str: string; hasEOL?: boolean };

function isTextItem(item: unknown): item is TextItem {
  if (!item || typeof item !== "object" || !("str" in item)) return false;
  return typeof (item as TextItem).str === "string";
}

export function paragraphsFromPdfItems(items: unknown[]) {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const value = item.str.replace(/\s+/g, " ").trim();
    if (value) line = line ? `${line} ${value}` : value;
    if (item.hasEOL && line) { lines.push(line); line = ""; }
  }
  if (line) lines.push(line);

  // PDF text does not carry HTML paragraphs reliably. Consecutive short lines
  // are grouped into readable prose while long lines remain their own block.
  const paragraphs: string[] = [];
  let paragraph = "";
  for (const nextLine of lines) {
    paragraph = paragraph ? `${paragraph} ${nextLine}` : nextLine;
    if (/[.!?:;]$/.test(nextLine) || paragraph.length > 900) {
      paragraphs.push(paragraph);
      paragraph = "";
    }
  }
  if (paragraph) paragraphs.push(paragraph);
  return paragraphs;
}

export async function extractPdfIntoWebPages(
  pdfUrl: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<WebReaderPage[]> {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error("The PDF could not be downloaded for web reading.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = await loadingTask.promise;
  try {
    const pages: WebReaderPage[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const text = await page.getTextContent();
      pages.push({ number, paragraphs: paragraphsFromPdfItems(text.items) });
      onProgress?.(number, document.numPages);
    }
    if (!pages.some((page) => page.paragraphs.length)) {
      throw new Error("This PDF does not contain selectable text. A text-based PDF is required for Web Reader.");
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
