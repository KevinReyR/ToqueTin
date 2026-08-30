create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> '')
);

create table public.restaurants (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  name text not null,
  timezone text not null default 'America/Bogota',
  day_cutoff_time time without time zone not null default time '00:00',
  pending_day_cutoff_time time without time zone,
  pending_cutoff_effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete restrict,
  constraint restaurants_name_not_blank check (btrim(name) <> ''),
  constraint restaurants_timezone_not_blank check (btrim(timezone) <> ''),
  constraint restaurants_pending_cutoff_consistent check (
    (pending_day_cutoff_time is null) =
    (pending_cutoff_effective_at is null)
  )
);

create index restaurants_organization_id_idx
on public.restaurants (organization_id);

alter table public.organizations enable row level security;
alter table public.restaurants enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.restaurants from anon, authenticated;
revoke all on sequence public.organizations_id_seq from anon, authenticated;
revoke all on sequence public.restaurants_id_seq from anon, authenticated;
