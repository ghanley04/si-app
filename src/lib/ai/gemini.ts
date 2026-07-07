import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiProvider, ChatTurn, GeneratedSession, SourceImage } from "./provider";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const CHAT_MODEL = "gemini-2.5-flash-lite";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 429 || status === 503;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_RETRIES - 1 || !isRetryable(error)) throw error;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export class GeminiProvider implements AiProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embed(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await withRetry(() =>
      model.embedContent({
        content: { role: "user", parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      } as Parameters<typeof model.embedContent>[0])
    );
    return result.embedding.values;
  }

  async chat(systemPrompt: string, history: ChatTurn[]): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction: systemPrompt,
    });

    const lastTurn = history[history.length - 1];
    const priorTurns = history.slice(0, -1);

    const chat = model.startChat({
      history: priorTurns.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
    });

    const result = await withRetry(() => chat.sendMessage(lastTurn.content));
    return result.response.text();
  }

  async ocrImage(imageBase64: string, mimeType: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: CHAT_MODEL });

    const result = await withRetry(() =>
      model.generateContent([
        {
          text: "Transcribe all text in this image, including handwritten text. Return only the transcribed text, with no commentary.",
        },
        { inlineData: { data: imageBase64, mimeType } },
      ])
    );

    return result.response.text();
  }

  async generateSession(
    systemPrompt: string,
    userPrompt: string,
    images: SourceImage[] = []
  ): Promise<GeneratedSession> {
    const model = this.client.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json" },
    });

    const parts = [
      { text: userPrompt },
      ...images.map((img) => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
    ];

    const result = await withRetry(() => model.generateContent(parts));
    const text = result.response.text();

    try {
      return JSON.parse(text) as GeneratedSession;
    } catch {
      throw new Error(`Model did not return valid JSON for a session: ${text}`);
    }
  }
}
