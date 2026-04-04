import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export const CUSTOM_PACK_CHARACTER_LIMIT = 5000;
const CUSTOM_PACK_SAMPLE_SLICE = 1000;

interface ExtractedFileTextResult {
  text: string;
  sourceKind: 'pdf' | 'txt';
  exceededLimit: boolean;
  convertedFilename: string;
  wasConvertedFromPdf: boolean;
  rawTextLength: number;
  extractedTextLength: number;
  pdfPageCount: number | null;
  isLikelyImageOnlyPdf: boolean;
}

function compactWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function sampleLargeText(text: string) {
  if (text.length <= CUSTOM_PACK_CHARACTER_LIMIT) {
    return text;
  }

  const firstChunk = text.slice(0, CUSTOM_PACK_SAMPLE_SLICE);
  const middleStart = Math.max(
    CUSTOM_PACK_SAMPLE_SLICE,
    Math.floor((text.length - CUSTOM_PACK_SAMPLE_SLICE) / 2)
  );
  const middleChunk = text.slice(middleStart, middleStart + CUSTOM_PACK_SAMPLE_SLICE);
  const lastChunk = text.slice(-CUSTOM_PACK_SAMPLE_SLICE);

  return compactWhitespace([
    firstChunk,
    middleChunk,
    lastChunk,
  ].join(' '));
}

function getConvertedTextFilename(filename: string) {
  if (filename.toLowerCase().endsWith('.pdf')) {
    return filename.replace(/\.pdf$/i, '.txt');
  }

  return filename;
}

async function extractTextFromPdf(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    if (pageText) {
      pageTexts.push(`Page ${pageNumber}: ${pageText}`);
    }
  }

  return {
    text: compactWhitespace(pageTexts.join('\n\n')),
    pageCount: document.numPages,
  };
}

export async function extractTextFromCustomPackFile(file: File): Promise<ExtractedFileTextResult> {
  const normalizedName = file.name.toLowerCase();
  const sourceKind = normalizedName.endsWith('.pdf') ? 'pdf' : 'txt';
  const convertedFilename = getConvertedTextFilename(file.name);
  const pdfExtraction =
    sourceKind === 'pdf'
      ? await extractTextFromPdf(file)
      : null;
  const rawText =
    sourceKind === 'pdf'
      ? (pdfExtraction?.text ?? '')
      : compactWhitespace(await file.text());
  const text =
    sourceKind === 'pdf'
      ? compactWhitespace([
        `Converted from PDF: ${file.name}`,
        rawText || `No extractable text was found in ${file.name}.`,
      ].join('\n\n'))
      : rawText;
  const exceededLimit = text.length > CUSTOM_PACK_CHARACTER_LIMIT;
  const finalText = exceededLimit ? sampleLargeText(text) : text;

  return {
    text: finalText,
    sourceKind,
    exceededLimit,
    convertedFilename,
    wasConvertedFromPdf: sourceKind === 'pdf',
    rawTextLength: text.length,
    extractedTextLength: finalText.length,
    pdfPageCount: pdfExtraction?.pageCount ?? null,
    isLikelyImageOnlyPdf: sourceKind === 'pdf' && rawText.length < 40,
  };
}
