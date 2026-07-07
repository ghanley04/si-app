"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMaterialButton({ materialId }: { materialId: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this material? This can't be undone.")) return;

    setDeleting(true);
    const res = await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Failed to delete material");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-md border border-sista-border px-3 py-1.5 text-xs font-semibold text-sista-muted shadow-sm hover:border-red-600 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
