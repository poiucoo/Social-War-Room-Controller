create table
  public.video_ai_insights (
    id uuid not null default extensions.uuid_generate_v4 (),
    video_id text not null,
    insight_type text not null default 'FULL_VIDEO_CHECKUP'::text,
    insight_content text not null,
    model_used text null default 'gemini-2.5-flash'::text,
    created_at timestamp with time zone not null default now(),
    constraint video_ai_insights_pkey primary key (id)
  ) tablespace pg_default;

-- Add RLS policies if you're using RLS
alter table public.video_ai_insights enable row level security;

create policy "Enable read access for all users"
on "public"."video_ai_insights"
as permissive
for select
to public
using (true);

create policy "Enable insert for all users"
on "public"."video_ai_insights"
as permissive
for insert
to public
with check (true);
