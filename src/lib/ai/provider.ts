export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GeneratedSession {
  warmUp: string[];
  groupProblems: { prompt: string; hint?: string; imageRef?: string }[];
  wrapUpCheck: string[];
}

// A diagram/figure image attached to a generateSession call. `label` is how
// the model must refer to it in its JSON output (e.g. "A"); `id` is the
// caller's own material_images.id, used to translate the model's label back
// to a real image without trusting anything the model echoes verbatim.
export interface SourceImage {
  id: string;
  label: string;
  base64: string;
  mimeType: string;
}

// Vendor-agnostic surface the rest of the app talks to. Swapping LLM providers
// (Anthropic, OpenAI, etc.) means adding a new adapter here and pointing
// AI_PROVIDER at it — no other app code changes.
export interface AiProvider {
  embed(text: string): Promise<number[]>;
  chat(systemPrompt: string, history: ChatTurn[]): Promise<string>;
  generateSession(
    systemPrompt: string,
    userPrompt: string,
    images?: SourceImage[]
  ): Promise<GeneratedSession>;
  ocrImage(imageBase64: string, mimeType: string): Promise<string>;
}

let cachedProvider: AiProvider | null = null;

export async function getAiProvider(): Promise<AiProvider> {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER ?? "gemini";

  switch (providerName) {
    case "gemini": {
      const { GeminiProvider } = await import("./gemini");
      cachedProvider = new GeminiProvider();
      return cachedProvider;
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: ${providerName}`);
  }
}
