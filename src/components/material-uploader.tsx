"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MaterialUploader({ courseId }: { courseId: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    const res = await fetch("/api/materials/ingest", { method: "POST", body: formData });
    const body = await res.json();

    if (!res.ok) {
      setStatus("error");
      setError(body.error ?? "Upload failed");
      return;
    }

    setStatus("idle");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="file"
        name="file"
        accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.heic,.heif,.webp"
        required
        className="text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-sista-plum file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:bg-sista-coral"
      />
      <button
        type="submit"
        disabled={status === "uploading"}
        className="rounded-md bg-sista-plum px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sista-coral focus:outline-none focus:ring-2 focus:ring-sista-plum focus:ring-offset-2 disabled:opacity-50"
      >
        {status === "uploading" ? "Processing…" : "Upload"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
