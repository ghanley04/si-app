# SI Companion

An AI study companion that stands in for a Purdue Supplemental Instruction (SI)
leader: upload a course's lecture notes/slides, then ask questions grounded in
that material or generate SI-style practice sessions (warm-up recall
questions, group problems, wrap-up check).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase — Postgres (`pgvector`), Auth, Storage
- Google Gemini API (`gemini-2.0-flash` + `text-embedding-004`) behind a
  provider abstraction (`src/lib/ai/provider.ts`) so it's easy to swap in
  Anthropic/OpenAI later

## Setup

1. **Supabase project** — create a free project at [supabase.com](https://supabase.com).
   - In the SQL Editor, run `supabase/migrations/0001_init.sql`. This creates
     the schema, RLS policies, the `match_material_chunks` similarity-search
     function, and a private `materials` storage bucket.
   - From Project Settings → API, grab the project URL, anon key, and
     service role key.
2. **Gemini API key** — create a free key at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Copy `.env.example` to `.env.local` and fill in the four values.
4. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), sign up, create a
   course, upload a PDF/text file of course material, then try Chat or
   generate a practice session.

## How it works

- **Ingestion** (`/api/materials/ingest`): extracts text from an uploaded
  file, chunks it (`src/lib/chunk.ts`), embeds each chunk, and stores the
  vectors in `material_chunks`.
- **Chat** (`/api/chat`): embeds the question, does a pgvector similarity
  search scoped to the course (`match_material_chunks` RPC), and answers
  using only the retrieved excerpts.
- **Practice sessions** (`/api/sessions/generate`): same retrieval step, then
  asks the model to return a structured JSON worksheet.

## Swapping the LLM provider later

Add a new file under `src/lib/ai/` implementing the `AiProvider` interface
from `src/lib/ai/provider.ts`, register it in the `switch` in `getAiProvider`,
and set `AI_PROVIDER` in `.env.local`. No other app code needs to change.
