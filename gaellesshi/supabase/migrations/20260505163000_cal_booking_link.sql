-- Cal.com webhook ingestion + link bookings to Cal slots.

create table if not exists public.cal_bookings (
  uid text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'confirmed',
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  event_title text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cal_bookings_attendee_email_idx on public.cal_bookings (lower(attendee_email));
create index if not exists cal_bookings_starts_at_idx on public.cal_bookings (starts_at);
create index if not exists cal_bookings_status_idx on public.cal_bookings (status);

alter table public.bookings add column if not exists cal_booking_uid text;
alter table public.bookings add column if not exists cal_booking_starts_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_cal_booking_uid_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_cal_booking_uid_fkey
      foreign key (cal_booking_uid) references public.cal_bookings(uid)
      on update cascade on delete set null;
  end if;
end
$$;

create unique index if not exists bookings_cal_booking_uid_unique
  on public.bookings (cal_booking_uid)
  where cal_booking_uid is not null;
