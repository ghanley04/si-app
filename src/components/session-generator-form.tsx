"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SessionGeneratorForm({ courseId }: { courseId: string }) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, topic }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate session");

      router.push(`/courses/${courseId}/sessions/${body.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (e.g. Le Chatelier's principle)"
        className="flex-1 rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate session"}
      </button>
      {error && <p className="text-sm text-red-600 self-center">{error}</p>}
    </form>
  );
}
