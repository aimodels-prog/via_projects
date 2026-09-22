/** Source reading only. OCR output is unverified evidence, never published data. */
export async function readDocumentEvidence(file: File, progress: (message: string) => void) {
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF limit is 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Choose a valid PDF document.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    if (pdf.numPages !== 1)
      throw new Error("Upload the single-page project summary for this template.");
    const page = await pdf.getPage(1),
      viewport = page.getViewport({ scale: 3 });
    if (viewport.width * viewport.height > 25_000_000)
      throw new Error("PDF page dimensions are too large.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF rendering is unavailable.");
    progress("Rendering source PDF…");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const content = await page.getTextContent();
    const nativeText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    const pagePreview = canvas.toDataURL("image/png");
    const sections: Array<{ label: string; text: string; confidence: number; image: string }> = [];
    if (nativeText.replace(/\s/g, "").length > 100)
      sections.push({
        label: "Embedded document text (verify table alignment)",
        text: nativeText,
        confidence: 0,
        image: pagePreview,
      });
    else {
      const { createWorker } = await import("tesseract.js");
      progress("Starting OCR for the image-based report…");
      const worker = await createWorker("eng");
      try {
        // Vertical regions avoid shrinking the page. No inferred field mapping.
        for (let i = 0; i < 4; i++) {
          progress(`Reading source section ${i + 1} of 4…`);
          const crop = document.createElement("canvas");
          crop.width = canvas.width;
          crop.height = Math.ceil(canvas.height * 0.28);
          const ctx = crop.getContext("2d")!;
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, crop.width, crop.height);
          ctx.drawImage(canvas, 0, -Math.floor(canvas.height * i * 0.24));
          const { data } = await worker.recognize(crop);
          sections.push({
            label: `Page 1 — section ${i + 1} (unverified OCR)`,
            text: data.text,
            confidence: data.confidence,
            image: crop.toDataURL("image/png"),
          });
        }
      } finally {
        await worker.terminate();
      }
    }
    return { pagePreview, sections };
  } finally {
    await task.destroy();
  }
}
