"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DeleteMaterialButton } from "@/components/delete-material-button";

const statusLabel: Record<string, string> = {
  pending: "Processing…",
  processed: "Ready",
  error: "Failed",
};

interface Material {
  id: string;
  filename: string;
  status: string;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
}

export function MaterialsList({
  materials,
  currentUserId,
  courseCreatedBy,
}: {
  materials: Material[];
  currentUserId: string | undefined;
  courseCreatedBy: string | undefined;
}) {
  const router = useRouter();
  const hasPending = materials.some((m) => m.status === "pending");

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [hasPending, router]);

  if (materials.length === 0) {
    return <p className="text-sm text-sista-muted">No materials uploaded yet.</p>;
  }

  return (
    <ul className="divide-y divide-sista-border rounded-md border border-sista-border bg-white">
      {materials.map((m) => (
        <li key={m.id} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">{m.filename}</span>
          <div className="flex items-center gap-3">
            <span
              className={
                "text-xs " + (m.status === "error" ? "text-red-600" : "text-sista-muted")
              }
              title={m.error_message ?? undefined}
            >
              {statusLabel[m.status] ?? m.status}
            </span>
            {(m.uploaded_by === currentUserId || courseCreatedBy === currentUserId) && (
              <DeleteMaterialButton materialId={m.id} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
