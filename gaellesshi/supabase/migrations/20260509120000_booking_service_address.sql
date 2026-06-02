-- House-call service location (street, city, etc.); null for studio appointments.
alter table public.bookings add column if not exists service_address text;

comment on column public.bookings.service_address is 'House-call location — required client-side when style_id starts with house-';
