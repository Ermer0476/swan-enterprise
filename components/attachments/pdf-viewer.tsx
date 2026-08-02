"use client";

import { useEffect, useRef, useState } from "react";

// Renders PDF pages onto <canvas> ourselves via pdf.js instead of relying on
// the browser's own PDF plugin in an <iframe> — that plugin isn't guaranteed
// to exist (headless/embedded browsers, or a user's "always download PDFs"
// setting), which is exactly what made the previous iframe-based viewer show
// a blank/black screen for valid PDFs.
export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto mb-4 block bg-white shadow";
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          containerRef.current?.appendChild(canvas);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex-1 overflow-auto bg-muted/30 p-4">
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading document…</p>}
      {error && <p className="py-8 text-center text-sm text-danger">{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}
