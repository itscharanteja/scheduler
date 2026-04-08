-- 012_social_feed.sql
-- Social feed: posts, likes, comments, reposts (via feed_posts.repost_of), reports

-- ─── feed_posts ───────────────────────────────────────────────────────────────
create table if not exists public.feed_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.user_profiles(id) on delete cascade,
  content     text not null default '',
  image_url   text,
  link_url    text,
  link_title  text,
  repost_of   uuid references public.feed_posts(id) on delete set null,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_feed_posts_author_id  on public.feed_posts(author_id);
create index if not exists idx_feed_posts_created_at on public.feed_posts(created_at desc);
create index if not exists idx_feed_posts_repost_of  on public.feed_posts(repost_of);

alter table public.feed_posts enable row level security;
create policy "anon can read feed_posts"   on public.feed_posts for select using (true);
create policy "anon can insert feed_posts" on public.feed_posts for insert with check (true);
create policy "anon can update feed_posts" on public.feed_posts for update using (true);

-- ─── feed_likes ───────────────────────────────────────────────────────────────
create table if not exists public.feed_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create index if not exists idx_feed_likes_post_id on public.feed_likes(post_id);
create index if not exists idx_feed_likes_user_id on public.feed_likes(user_id);

alter table public.feed_likes enable row level security;
create policy "anon can read feed_likes"   on public.feed_likes for select using (true);
create policy "anon can insert feed_likes" on public.feed_likes for insert with check (true);
create policy "anon can delete feed_likes" on public.feed_likes for delete using (true);

-- ─── feed_comments ────────────────────────────────────────────────────────────
create table if not exists public.feed_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  author_id  uuid not null references public.user_profiles(id) on delete cascade,
  content    text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_comments_post_id on public.feed_comments(post_id);

alter table public.feed_comments enable row level security;
create policy "anon can read feed_comments"   on public.feed_comments for select using (true);
create policy "anon can insert feed_comments" on public.feed_comments for insert with check (true);
create policy "anon can update feed_comments" on public.feed_comments for update using (true);

-- ─── feed_reports ─────────────────────────────────────────────────────────────
create table if not exists public.feed_reports (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.feed_posts(id) on delete cascade,
  reporter_id  uuid not null references public.user_profiles(id) on delete cascade,
  reason       text not null default '',
  status       text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  reviewed_by  uuid references public.user_profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique(post_id, reporter_id)
);

create index if not exists idx_feed_reports_post_id on public.feed_reports(post_id);
create index if not exists idx_feed_reports_status  on public.feed_reports(status);

alter table public.feed_reports enable row level security;
create policy "anon can read feed_reports"   on public.feed_reports for select using (true);
create policy "anon can insert feed_reports" on public.feed_reports for insert with check (true);
create policy "anon can update feed_reports" on public.feed_reports for update using (true);
