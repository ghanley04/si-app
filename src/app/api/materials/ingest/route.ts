import { NextRequest, NextResponse, after } from "next/server";
import type { PDFParse } from "pdf-parse";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { chunkText, chunkPages } from "@/lib/chunk";
import { getAiProvider, type AiProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

// PDFs made from scanned/handwritten pages carry little or no embedded text.
// Below this length we treat the PDF as image-only and fall back to OCR.
const MIN_EXTRACTED_TEXT_LENGTH = 40;

// Skip embedded images below this size (icons, bullets, logos) — only keep
// things large enough to plausibly be a diagram/figure.
const IMAGE_THRESHOLD_PX = 100;

// Bound storage growth for image-heavy materials (e.g. a slide deck).
const MAX_IMAGES_PER_MATERIAL = 12;

function imageMimeType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return IMAGE_MIME_TYPES[ext] ?? null;
}

interface ExtractedImage {
  data: Buffer;
  pageNumber: number;
  width: number | null;
  height: number | null;
  source: "embedded" | "page_screenshot" | "direct_upload";
}

interface ExtractionResult {
  // null when the source has no page concept (plain text/markdown upload).
  pages: { num: number; text: string }[] | null;
  flatText: string;
  images: ExtractedImage[];
}

async function ocrPdfPages(
  parser: PDFParse,
  ai: AiProvider
): Promise<{ pages: { num: number; text: string }[]; images: ExtractedImage[] }> {
  const { pages } = await parser.getScreenshot({ imageBuffer: true });

  const textPages: { num: number; text: string }[] = [];
  const images: ExtractedImage[] = [];
  for (const page of pages) {
    const buffer = Buffer.from(page.data);
    const text = await ai.ocrImage(buffer.toString("base64"), "image/png");
    textPages.push({ num: page.pageNumber, text });
    if (images.length < MAX_IMAGES_PER_MATERIAL) {
      images.push({
        data: buffer,
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        source: "page_screenshot",
      });
    }
  }
  return { pages: textPages, images };
}

async function extractContent(file: File, ai: AiProvider): Promise<ExtractionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const imageMime = imageMimeType(file);
  if (imageMime) {
    const text = await ai.ocrImage(buffer.toString("base64"), imageMime);
    return {
      pages: [{ num: 1, text }],
      flatText: text,
      images: [{ data: buffer, pageNumber: 1, width: null, height: null, source: "direct_upload" }],
    };
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text;

      // pdf-parse's default page joiner ("-- N of M --") pads result.text even
      // when every page has zero real text, so the threshold must be checked
      // against actual per-page content, not the joined string.
      const realTextLength = result.pages.reduce((sum, p) => sum + p.text.trim().length, 0);

      if (realTextLength < MIN_EXTRACTED_TEXT_LENGTH) {
        const { pages, images } = await ocrPdfPages(parser, ai);
        return { pages, flatText: pages.map((p) => p.text).join("\n\n"), images };
      }

      const imageResult = await parser.getImage({
        imageThreshold: IMAGE_THRESHOLD_PX,
        imageBuffer: true,
      });
      const images: ExtractedImage[] = [];
      outer: for (const page of imageResult.pages) {
        for (const img of page.images) {
          if (images.length >= MAX_IMAGES_PER_MATERIAL) break outer;
          images.push({
            data: Buffer.from(img.data),
            pageNumber: page.pageNumber,
            width: img.width,
            height: img.height,
            source: "embedded",
          });
        }
      }

      return { pages: result.pages, flatText: text, images };
    } finally {
      await parser.destroy();
    }
  }

  const text = buffer.toString("utf-8");
  return { pages: null, flatText: text, images: [] };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const courseId = String(formData.get("courseId") ?? "");

  if (!(file instanceof File) || !courseId) {
    return NextResponse.json({ error: "Missing file or courseId" }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  const storagePath = `${courseId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("materials")
    .upload(storagePath, file);
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: material, error: insertError } = await supabase
    .from("materials")
    .insert({
      course_id: courseId,
      uploaded_by: user.id,
      filename: file.name,
      storage_path: storagePath,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !material) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create material record" },
      { status: 500 }
    );
  }

  const serviceClient = createServiceRoleClient();

  // Extraction/OCR/embedding can take a while; run it after the response is
  // sent so the client sees the "pending" row immediately instead of the
  // request hanging until the whole material is processed.
  after(async () => {
    try {
      const ai = await getAiProvider();
      const { pages, flatText, images } = await extractContent(file, ai);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imagePath = `${courseId}/${material.id}/images/${image.pageNumber}-${i}.png`;
        const { error: imageUploadError } = await serviceClient.storage
          .from("materials")
          .upload(imagePath, image.data, { contentType: "image/png" });
        if (imageUploadError) throw new Error(imageUploadError.message);

        // pdf-parse reports embedded image dimensions in PDF user-space units,
        // which are not guaranteed to be whole numbers, but the columns are int.
        const { error: imageInsertError } = await serviceClient.from("material_images").insert({
          material_id: material.id,
          course_id: courseId,
          page_number: image.pageNumber,
          storage_path: imagePath,
          width: image.width != null ? Math.round(image.width) : null,
          height: image.height != null ? Math.round(image.height) : null,
          source: image.source,
        });
        if (imageInsertError) throw new Error(imageInsertError.message);
      }

      const rows: {
        material_id: string;
        course_id: string;
        content: string;
        chunk_index: number;
        page_number: number | null;
        embedding: number[];
      }[] = [];

      if (pages) {
        const pageChunks = chunkPages(pages);
        for (let i = 0; i < pageChunks.length; i++) {
          const embedding = await ai.embed(pageChunks[i].content);
          rows.push({
            material_id: material.id,
            course_id: courseId,
            content: pageChunks[i].content,
            chunk_index: i,
            page_number: pageChunks[i].pageNumber,
            embedding,
          });
        }
      } else {
        const chunks = chunkText(flatText);
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await ai.embed(chunks[i]);
          rows.push({
            material_id: material.id,
            course_id: courseId,
            content: chunks[i],
            chunk_index: i,
            page_number: null,
            embedding,
          });
        }
      }

      if (rows.length === 0) {
        throw new Error("No extractable text found in file");
      }

      const { error: chunksError } = await serviceClient.from("material_chunks").insert(rows);
      if (chunksError) throw new Error(chunksError.message);

      await serviceClient
        .from("materials")
        .update({ status: "processed" })
        .eq("id", material.id);
    } catch (err) {
      await serviceClient
        .from("materials")
        .update({
          status: "error",
          error_message: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", material.id);
    }
  });

  return NextResponse.json({ materialId: material.id, status: "pending" });
}
