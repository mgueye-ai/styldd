import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** True when DB rejects user_id because auth.users row is missing (e.g. after a data wipe). */
export function isStaleAuthUserDbError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('styld_site_records_user_id_fkey') ||
    lower.includes('violates foreign key constraint') ||
    lower.includes('user from sub claim') ||
    lower.includes('does not exist')
  );
}

/** Validates JWT against Supabase Auth — returns null if session user was deleted. */
export async function resolveLiveAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
