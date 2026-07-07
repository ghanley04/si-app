-- Diagram/figure images extracted from uploaded course materials, linked to
-- the page they came from so generated questions can cite a real image.
create table if not exists material_images (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  page_number int not null,
  storage_path text not null,
  width int,
  height int,
  source text not null check (source in ('embedded', 'page_screenshot', 'direct_upload')),
  created_at timestamptz not null default now()
);

create index if not exists material_images_material_page_idx
  on material_images (material_id, page_number);

alter table material_chunks add column if not exists page_number int;

alter table material_images enable row level security;

create policy "material images are readable by enrolled course members"
  on material_images for select using (is_enrolled(course_id));
create policy "material images are insertable by enrolled course members"
  on material_images for insert with check (is_enrolled(course_id));

-- match_material_chunks now also returns page_number so generation can look
-- up which images are available for a retrieved excerpt; return shape
-- changed, so the old function must be dropped first.
drop function if exists match_material_chunks(vector(768), uuid, int);

create or replace function match_material_chunks(
  query_embedding vector(768),
  target_course_id uuid,
  match_count int default 6
)
returns table (
  id uuid,
  material_id uuid,
  content text,
  page_number int,
  similarity float
)
language sql
stable
as $$
  select
    material_chunks.id,
    material_chunks.material_id,
    material_chunks.content,
    material_chunks.page_number,
    1 - (material_chunks.embedding <=> query_embedding) as similarity
  from material_chunks
  where material_chunks.course_id = target_course_id
  order by material_chunks.embedding <=> query_embedding
  limit match_count;
$$;
