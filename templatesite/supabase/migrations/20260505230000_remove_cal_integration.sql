-- Remove Cal.com integration: FK, columns, and webhook storage table.

alter table public.bookings drop constraint if exists bookings_cal_booking_uid_fkey;

drop index if exists bookings_cal_booking_uid_unique;

alter table public.bookings drop column if exists cal_booking_uid;
alter table public.bookings drop column if exists cal_booking_starts_at;

drop table if exists public.cal_bookings;
