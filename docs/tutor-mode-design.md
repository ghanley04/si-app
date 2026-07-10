# Tutor Mode — Design Doc

Adaptive, self-paced practice that sits alongside the existing SI worksheet
generator. A student works questions on a topic; when they hit **80% mastery**
at a difficulty tier they unlock the next tier; an **answer key** is revealed
after every question; and a **weakness report** shows which topics need work.

Status: **proposal** — review and edit before implementation.

---

## 1. How it fits the existing app

Reused as-is:

- **RAG retrieval** — `materials` → `material_chunks` (+ embeddings) and
  `match_material_chunks()`. Tutor questions are generated from the same
  grounded excerpts, so nothing is invented outside the course material.
- **AI provider seam** — `src/lib/ai/provider.ts`. We add two methods
  (`generateQuestions`, `gradeAnswer`) behind the same vendor-agnostic
  interface; no other app code cares which LLM runs.
- **Auth / courses / enrollments / RLS** — unchanged. Tutor data is
  per-student and gated by the existing `is_enrolled()` helper.

Left untouched: `practice_sessions` and `generateSession` remain the **group /
SI worksheet** path (warm-up / group problems / wrap-up). Tutor mode is the new
**individual adaptive** path. They can share materials but are separate flows.

---

## 2. Core decisions (locked)

| Decision | Choice |
|---|---|
| Question format | **Free-text** answers |
| Grading | **AI grades** into a 3-state rubric; **student can override** |
| Rubric | `correct` (right) · `ok` (right method, arithmetic/minor slip) · `wrong` |
| Mastery gate | **80%** of a rolling window, **per topic × difficulty** |
| Level scope | **Per topic** — a student can be on Hard for topic A, Easy for topic B |

Grading is deliberately a *suggestion*: the AI proposes a grade and short
feedback, the student sees the worked answer key, and can override the grade
(e.g. bump a harsh `wrong` to `ok`). Both the AI grade and the final grade are
stored so we can measure how often students override.

---

## 3. Mastery math

Each graded attempt is worth points:

```
correct → 1.0
ok      → OK_WEIGHT   (default 0.5, tunable)
wrong   → 0.0
```

For a `(student, course, topic, level)`, mastery over the last `WINDOW` graded
attempts:

```
mastery = sum(points of last WINDOW attempts) / count
advance when: count >= MIN_ATTEMPTS  AND  mastery >= 0.80
```

Suggested constants (all config, easy to tune later):

```ts
const OK_WEIGHT     = 0.5;   // partial credit for right-method/wrong-arithmetic
const WINDOW        = 10;    // rolling window of recent attempts at this level
const MIN_ATTEMPTS  = 8;     // don't unlock on a lucky 4/5 start
const PASS_THRESHOLD = 0.80; // the "80%" gate
```

Progression rules:

- Levels: `easy → medium → hard`. A student starts every topic at `easy`.
- On **advance**, `current_level` for that topic moves up one; `hard` is the
  ceiling (staying ≥80% on hard just = mastered).
- **No auto-demotion.** Once a tier is unlocked it stays unlocked, even if the
  student later slips — the gate only ever moves up. *(Decided.)*
- The window is per *level*, so unlocking Medium starts a fresh Medium window —
  Easy history doesn't carry over.
- Only **confirmed** attempts count toward the window (see §7).

---

## 4. Data model

Four new tables. DDL is a starting point — column names/policies open to edits.

```sql
-- Per-course topic list (seeds progress + weakness report before any attempts).
-- Populated once from materials (AI topic extraction) or by a leader.
create table course_topics (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references courses(id) on delete cascade,
  name       text not null,
  source     text not null default 'ai' check (source in ('ai','leader')),
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);

-- The question bank. The answer key lives here (answer + worked solution).
create table quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  topic       text not null,                     -- matches course_topics.name
  difficulty  text not null check (difficulty in ('easy','medium','hard')),
  stem        text not null,                     -- the question shown to the student
  answer      text not null,                     -- final answer (answer key)
  solution    text not null,                     -- worked explanation (answer key)
  image_ref   uuid references material_images(id),
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index quiz_questions_course_topic_idx
  on quiz_questions (course_id, topic, difficulty);

-- Every student answer + how it was graded.
create table quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  question_id  uuid not null references quiz_questions(id) on delete cascade,
  topic        text not null,                    -- denormalized for fast rollups
  difficulty   text not null check (difficulty in ('easy','medium','hard')),
  response     text not null,
  ai_grade     text not null check (ai_grade    in ('correct','ok','wrong')),
  final_grade  text          check (final_grade in ('correct','ok','wrong')), -- null until confirmed
  confirmed    boolean not null default false,   -- student explicitly confirmed the grade
  overridden   boolean not null default false,   -- did the student change the AI's grade?
  ai_feedback  text,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz
);
create index quiz_attempts_progress_idx
  on quiz_attempts (user_id, course_id, topic, difficulty, created_at desc);

-- Where each student currently sits, per topic. The gate writes here.
create table topic_progress (
  user_id       uuid not null references profiles(id) on delete cascade,
  course_id     uuid not null references courses(id) on delete cascade,
  topic         text not null,
  current_level text not null default 'easy'
                check (current_level in ('easy','medium','hard')),
  updated_at    timestamptz not null default now(),
  primary key (user_id, course_id, topic)
);
```

RLS (mirrors existing patterns):

- `course_topics`, `quiz_questions` — **select** where `is_enrolled(course_id)`;
  insert via generation (enrolled user or service role).
- `quiz_attempts`, `topic_progress` — select/insert/update only where
  `auth.uid() = user_id`. A student only ever sees their own attempts/progress.

Denormalizing `topic`/`difficulty` onto `quiz_attempts` keeps the mastery
rollup a single indexed query with no join to `quiz_questions`.

---

## 5. AI provider additions

```ts
export type Grade = "correct" | "ok" | "wrong";

export interface GeneratedQuestion {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  answer: string;    // final answer
  solution: string;  // worked steps → the answer key
  imageRef?: string; // label resolved back to material_images.id, as today
}

export interface GradeResult {
  grade: Grade;
  feedback: string;  // 1–2 sentences: what was right / where it went wrong
}

export interface AiProvider {
  // ...existing embed / chat / generateSession / ocrImage...
  generateQuestions(
    systemPrompt: string,
    userPrompt: string,
    images?: SourceImage[]
  ): Promise<GeneratedQuestion[]>;

  gradeAnswer(
    question: string,
    answerKey: string,   // answer + solution
    studentResponse: string
  ): Promise<GradeResult>;
}
```

**Difficulty rubric** baked into the generation prompt so tiers are consistent:

- **easy** — direct recall / one-step application of a single idea.
- **medium** — combine 2–3 ideas, a multi-step calculation, or light transfer.
- **hard** — multi-step reasoning, synthesis across topics, or novel transfer.

**Grading prompt** returns strict JSON `{grade, feedback}` and is told exactly
what `ok` means: *final answer wrong but the method/setup is correct — e.g. an
arithmetic slip.* Grade is a **suggestion**; the UI lets the student override.

---

## 6. Generation flow

1. **Topics** (once per course): AI reads representative chunks and proposes a
   topic list → `course_topics`, **and** a leader can add/rename/remove topics
   by hand. Both paths write the same table; a `source` column (`ai` | `leader`)
   records which. This is the *both* option — AI gives a fast first draft, the
   leader curates.
2. **Questions** (on demand): `POST /api/tutor/generate { courseId, topic,
   difficulty, count }`. Retrieve topic chunks via `match_material_chunks()`
   (reusing the image-attachment logic already in `sessions/generate`), prompt
   `generateQuestions`, insert rows into `quiz_questions`.
   - Generate lazily (top up when a student runs low at their level) or in a
     small batch per topic/level. Cache in the bank so cost is amortized across
     students.

---

## 7. Grade + gate flow (per answered question)

The student **must confirm every grade** — the AI grade is only a suggestion
shown alongside the answer key; nothing counts toward mastery until the student
clicks a grade. Two steps:

```
POST /api/tutor/attempts { questionId, response }
  ├─ load question (answer + solution)
  ├─ ai = gradeAnswer(stem, answer+solution, response)
  ├─ insert quiz_attempts { ai_grade: ai.grade, ai_feedback: ai.feedback,
  │                         final_grade: null, confirmed: false }
  └─ return { attemptId, aiGrade, feedback, answer, solution }  // reveal answer key
                                                                 // NOT yet counted

PATCH /api/tutor/attempts/:id { final_grade }        // student confirms (or overrides)
  ├─ update final_grade, confirmed = true, confirmed_at = now(),
  │         overridden = (final_grade != ai_grade)
  └─ recomputeProgress(...)   // now, and only now, it counts

recomputeProgress(user, course, topic):
  window = last WINDOW *confirmed* attempts at current_level (by created_at)
  if window.count >= MIN_ATTEMPTS and weightedMastery(window) >= 0.80:
      current_level = next(current_level)   // easy→medium→hard
```

- The UI pre-selects the AI's suggested grade, so confirming an agreed grade is
  one click; changing it sets `overridden = true`.
- Unconfirmed attempts (`confirmed = false`) are ignored by the gate and the
  weakness report — they're just an in-progress answer the student hasn't graded
  yet. A "Next" button that leaves a grade unconfirmed simply doesn't count.

---

## 8. Weakness report

One query per student per course, grouped by topic:

```
per topic:
  current_level
  mastery% at current_level (weighted, over window)
  accuracy per level (easy/med/hard)
  attempts count
  flags:
    - "needs work"  → mastery < 80% at current level
    - "stuck"       → many attempts, not advancing
    - "not started" → 0 attempts
sort ascending by mastery%   → weakest topics first
```

Each row has a **"Practice this"** CTA that generates/serves questions on that
topic at the student's current level — closing the loop back into §6.

---

## 9. UI surfaces

- **Practice hub** (`/courses/[id]/practice`) — the weakness report *is* the
  hub: a list of topics with a mastery bar, current tier badge, and flags.
  Weakest first. This is the "what am I bad at" view.
- **Practice runner** (`/courses/[id]/practice/[topic]`) — one question at a
  time: stem → textarea → **Submit** reveals the answer key + AI grade +
  feedback → student confirms or overrides (`correct`/`ok`/`wrong`) → **Next**.
  A progress bar shows distance to the 80% gate; crossing it shows a "Level up
  → Medium" moment.
- **Answer-key review** (`/courses/[id]/practice/review`) — history of attempted
  questions with the worked solution and the grade, for study.

---

## 10. Decisions (resolved)

- **`ok` = 0.5** partial credit toward mastery. ✔
- **No auto-demotion** — the gate only moves up. ✔
- **Topics: both** AI-extracted *and* leader-authored (`course_topics.source`). ✔
- **Student confirms every grade** — the AI grade is a suggestion; nothing
  counts until confirmed (`quiz_attempts.confirmed`). ✔

Still tunable (not blocking): the constants `OK_WEIGHT`, `WINDOW`,
`MIN_ATTEMPTS`, `PASS_THRESHOLD`, and whether questions are pre-generated in a
batch per topic/level or generated lazily per student (cost vs. first-question
latency — start lazy, add batching if latency hurts).

---

## 11. Build order (after this doc is approved)

1. Migration `0003_tutor_mode.sql` — the four tables + RLS.
2. Provider methods `generateQuestions` + `gradeAnswer` (Gemini adapter).
3. Routes: `tutor/generate`, `tutor/attempts` (POST + PATCH), progress recompute.
4. Pages: practice hub (weakness report) → runner → review.
5. Optional: topic-extraction step for `course_topics`.
