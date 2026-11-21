-- ASTRAEA · A sky of wishes — ตั้งค่าฐานข้อมูลท้องฟ้าร่วมกัน (Supabase)
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → New query แล้วกด Run (รันซ้ำได้ ไม่เป็นไร)

create table if not exists public.lanterns (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 60),
  wish       text        not null check (char_length(wish) between 1 and 300),
  color      smallint    not null default 0 check (color between 0 and 4),
  owner      text        not null check (char_length(owner) between 16 and 64),
  created_at timestamptz not null default now()
);
create index if not exists lanterns_id_idx    on public.lanterns (id desc);
create index if not exists lanterns_owner_idx on public.lanterns (owner);

-- ล็อกตารางไว้: เว็บเข้าถึงได้เฉพาะผ่านฟังก์ชันด้านล่างเท่านั้น
alter table public.lanterns enable row level security;
revoke all on public.lanterns from anon, authenticated;

-- อ่านท้องฟ้า (p_mine = true คือเฉพาะโคมของเจ้าของ)
create or replace function public.get_lanterns(p_owner text default '', p_mine boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  total bigint;
  items jsonb;
begin
  select count(*) into total from public.lanterns where (not p_mine) or owner = p_owner;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'wish', t.wish, 'color', t.color,
           'createdAt', t.created_at, 'mine', (t.owner = p_owner)
         ) order by t.id desc), '[]'::jsonb)
    into items
    from (select * from public.lanterns
           where (not p_mine) or owner = p_owner
           order by id desc
           limit (case when p_mine then 200 else 40 end)) t;
  return jsonb_build_object('total', total, 'lanterns', items);
end $$;

-- ฝากคำอธิษฐานใหม่
create or replace function public.add_lantern(p_owner text, p_name text, p_wish text, p_color int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n text := btrim(coalesce(p_name, ''));
  w text := btrim(coalesce(p_wish, ''));
  c int  := coalesce(p_color, 0);
  r public.lanterns;
begin
  if char_length(coalesce(p_owner, '')) < 16 or char_length(p_owner) > 64 then
    raise exception 'ไม่สามารถระบุเจ้าของโคมได้ กรุณารีเฟรชหน้าเว็บ';
  end if;
  if n = '' or char_length(n) > 60 or w = '' or char_length(w) > 300 then
    raise exception 'กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร) และคำอธิษฐาน (ไม่เกิน 300 ตัวอักษร)';
  end if;
  if c < 0 or c > 4 then c := 0; end if;
  -- กันส่งรัว: คนละไม่เกิน 3 ดวง/นาที และทั้งท้องฟ้าไม่เกิน 60 ดวง/นาที
  if (select count(*) from public.lanterns where owner = p_owner and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'ส่งคำอธิษฐานถี่เกินไป รอสักครู่แล้วลองอีกครั้ง';
  end if;
  if (select count(*) from public.lanterns where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'ท้องฟ้าหนาแน่นชั่วคราว ลองใหม่ในอีกสักครู่';
  end if;
  insert into public.lanterns (name, wish, color, owner) values (n, w, c, p_owner) returning * into r;
  return jsonb_build_object('lantern', jsonb_build_object(
    'id', r.id, 'name', r.name, 'wish', r.wish, 'color', r.color,
    'createdAt', r.created_at, 'mine', true));
end $$;

-- ลบโคมของตัวเอง
create or replace function public.delete_lantern(p_owner text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  delete from public.lanterns where id = p_id and owner = p_owner;
  get diagnostics cnt = row_count;
  return jsonb_build_object('deleted', cnt > 0);
end $$;

revoke all on function public.get_lanterns(text, boolean)       from public;
revoke all on function public.add_lantern(text, text, text, int) from public;
revoke all on function public.delete_lantern(text, bigint)       from public;
grant execute on function public.get_lanterns(text, boolean)       to anon, authenticated;
grant execute on function public.add_lantern(text, text, text, int) to anon, authenticated;
grant execute on function public.delete_lantern(text, bigint)       to anon, authenticated;
