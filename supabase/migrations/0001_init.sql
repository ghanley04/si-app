-- SI Leader Replacement App: initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists vector;

-- Mirrors auth.users with app-specific fields.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'leader')),
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  term text,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  user_id uuid not null references profiles (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  uploaded_by uuid not null references profiles (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

-- Gemini gemini-embedding-001, truncated via outputDimensionality, produces 768-dim vectors.
create table if not exists material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  content text not null,
  chunk_index int not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists material_chunks_embedding_idx
  on material_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  topic text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- Helper: is the current user enrolled in a given course?
create or replace function is_enrolled(target_course_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from enrollments
    where course_id = target_course_id and user_id = auth.uid()
  );
$$;

alter table profiles enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table materials enable row level security;
alter table material_chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table practice_sessions enable row level security;

create policy "profiles are self-readable and self-writable"
  on profiles for select using (true);
create policy "profiles are self-updatable"
  on profiles for update using (auth.uid() = id);
create policy "profiles are self-insertable"
  on profiles for insert with check (auth.uid() = id);

create policy "courses are readable by anyone signed in"
  on courses for select using (auth.uid() is not null);
create policy "courses are insertable by any signed-in user"
  on courses for insert with check (auth.uid() = created_by);

create policy "enrollments are readable by the enrolled user"
  on enrollments for select using (auth.uid() = user_id);
create policy "users can enroll themselves"
  on enrollments for insert with check (auth.uid() = user_id);
create policy "users can unenroll themselves"
  on enrollments for delete using (auth.uid() = user_id);

create policy "materials are readable by enrolled course members"
  on materials for select using (is_enrolled(course_id));
create policy "materials are insertable by enrolled course members"
  on materials for insert with check (is_enrolled(course_id) and auth.uid() = uploaded_by);

create policy "chunks are readable by enrolled course members"
  on material_chunks for select using (is_enrolled(course_id));
create policy "chunks are insertable by enrolled course members"
  on material_chunks for insert with check (is_enrolled(course_id));

create policy "chat sessions are owned by the creating user"
  on chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat messages are readable/writable by the session owner"
  on chat_messages for all using (
    exists (select 1 from chat_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from chat_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "practice sessions are readable by enrolled course members"
  on practice_sessions for select using (is_enrolled(course_id));
create policy "practice sessions are insertable by enrolled course members"
  on practice_sessions for insert with check (is_enrolled(course_id) and auth.uid() = created_by);

-- Similarity search RPC used by the chat + session-generation RAG pipeline.
create or replace function match_material_chunks(
  query_embedding vector(768),
  target_course_id uuid,
  match_count int default 6
)
returns table (
  id uuid,
  material_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    material_chunks.id,
    material_chunks.material_id,
    material_chunks.content,
    1 - (material_chunks.embedding <=> query_embedding) as similarity
  from material_chunks
  where material_chunks.course_id = target_course_id
  order by material_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Storage bucket for uploaded course materials.
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "materials bucket readable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'materials' and auth.uid() is not null);

create policy "materials bucket writable by authenticated users"
  on storage.objects for insert
  with check (bucket_id = 'materials' and auth.uid() is not null);
