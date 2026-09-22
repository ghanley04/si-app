// File-reading helpers for SIsta: base64 data URLs and PDF → plain text.
// Extracted from main.js. Uses pdf.js (loaded on demand from a CDN) for
// in-browser extraction, and falls back to Claude's native PDF reading for
// scanned/image PDFs. Touches only browser globals + the AI client, never app
// state or the DOM tree.

import { callClaude, claudeReady } from "./ai.js";

// Reads a File as a base64 data URL.
export function readAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error("Couldn't read the file.")); };
    r.readAsDataURL(file);
  });
}

// Loads the pdf.js library once, on demand, from a CDN. This lets the app
// read PDFs entirely in the browser — no API key required.
var PDFJS_VER = "3.11.174";
var pdfjsLoading = null;
export function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoading) return pdfjsLoading;
  pdfjsLoading = new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.min.js";
    s.onload = function () {
      if (!window.pdfjsLib) { reject(new Error("PDF reader failed to load.")); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = function () { reject(new Error("Couldn't load the PDF reader (offline?).")); };
    document.head.appendChild(s);
  });
  return pdfjsLoading;
}

// Extracts text from a PDF in the browser with pdf.js. Works for any
// text-based PDF (syllabi, slides, problem sets) with no API key.
async function extractPdfTextLocal(file) {
  var pdfjsLib = await loadPdfJs();
  var buf = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  var pages = [];
  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);
    var content = await page.getTextContent();
    var line = content.items.map(function (it) { return it.str; }).join(" ");
    pages.push(line);
  }
  return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Sends a PDF to Claude, which reads it natively (handles scanned/image
// PDFs that have no embedded text). Requires an API key.
async function extractPdfTextClaude(file) {
  var dataUrl = await readAsDataURL(file);
  var base64 = String(dataUrl).split(",")[1] || "";
  var system = "You extract the readable text from a PDF. Return the document's full text as clean plain text: keep headings, dates, lists, and tables in a readable form, drop page headers/footers and layout noise. Output only the extracted text — no preamble or commentary.";
  var content = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: "Extract all of the text from this document." }
  ];
  return (await callClaude({ system: system, content: content, maxTokens: 8192 })).trim();
}

// Reads a PDF to plain text. Tries in-browser parsing first (no key needed);
// if that finds no embedded text (e.g. a scanned PDF) and a key is set, it
// falls back to Claude's native PDF reading.
export async function extractPdfText(file) {
  var local = "";
  try { local = await extractPdfTextLocal(file); } catch (e) { local = ""; }
  if (local && local.replace(/\s/g, "").length > 20) return local;
  if (claudeReady()) {
    try { return await extractPdfTextClaude(file); } catch (e) { if (local) return local; throw e; }
  }
  return local;
}
