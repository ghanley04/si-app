"use client";

import { useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { index: number; chunkId: string; materialId: string }[];
}

export function ChatPanel({
  courseId,
  sessionId,
  initialMessages,
}: {
  courseId: string;
  sessionId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, role: "user", content: text },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, sessionId, message: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send message");

      setMessages((prev) => [...prev, body.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4 min-h-[300px]">
        {messages.length === 0 && (
          <p className="text-sm text-sista-muted">
            Ask a question about this course. Answers are grounded in whatever
            materials have been uploaded.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              "max-w-[85%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap " +
              (m.role === "user"
                ? "ml-auto bg-sista-plum text-white"
                : "bg-sista-cream text-sista-charcoal")
            }
          >
            {m.content}
            {m.citations && m.citations.length > 0 && (
              <p className="mt-1 text-xs opacity-90">
                Sources: {m.citations.map((c) => `[${c.index}]`).join(" ")}
              </p>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-sista-muted">Thinking…</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this course…"
          className="flex-1 rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-sista-plum px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sista-coral focus:outline-none focus:ring-2 focus:ring-sista-plum focus:ring-offset-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
