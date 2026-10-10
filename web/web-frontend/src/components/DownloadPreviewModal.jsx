import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { API_URL } from "../config/api";

const DownloadPreviewModal = ({ file, onClose }) => {
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const frameRef = useRef(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    const loadPreview = async () => {
      try {
        let pdfBlob = file.blob;
        if (pdfBlob.type !== "application/pdf") {
          const formData = new FormData();
          formData.append("file", file.blob, file.filename);
          const response = await fetch(`${API_URL}/downloads/preview-file`, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            const responseData = await response.json().catch(() => ({}));
            throw new Error(responseData.detail || "The file could not be rendered for preview.");
          }
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("application/pdf")) {
            throw new Error("The server did not return a printable file preview.");
          }
          pdfBlob = await response.blob();
        }

        objectUrl = URL.createObjectURL(pdfBlob);
        if (active) setSource(objectUrl);
      } catch (previewError) {
        if (active) setError(previewError.message || "The file preview could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return createPortal((
    <div className="fixed inset-0 z-[10000] bg-[#525659]" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="generated-file-preview-title" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#525659]">
        <header className="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-700 bg-[#323639] px-4 py-3 text-white shadow-md sm:px-6">
          <div className="min-w-0">
            <h2 id="generated-file-preview-title" className="truncate font-semibold">File preview</h2>
            <p className="truncate text-sm text-slate-300">{file.filename}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
        </header>
        {error ? <div role="alert" className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}
        {loading ? <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-white"><LoaderCircle size={18} className="animate-spin" /> Preparing print-layout preview…</div> : source ? <iframe ref={frameRef} title={`Preview of ${file.filename}`} src={source} className="min-h-0 w-full flex-1 border-0 bg-[#525659]" /> : null}
      </section>
    </div>
  ), document.body);
};

export default DownloadPreviewModal;
