import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://udxatwvbxpefbdhnsycf.supabase.co';
const FALLBACK_KEY = 'sb_publishable_HPoFuihcUtFr1Dsj1cLpwA_8R2z6snG';

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface AuthSnapshot {
  session: Session | null;
  user: User | null;
}

export async function getAuthSnapshot(): Promise<AuthSnapshot> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return { session: data.session, user: data.session?.user ?? null };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, displayName: string, inviteCode: string): Promise<void> {
  const { data: valid, error: validationError } = await supabase.rpc('validate_invite_code', { p_code: inviteCode });
  if (validationError || !valid) throw validationError ?? new Error('That invitation code is invalid or has reached its limit.');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: { display_name: displayName, invite_code: inviteCode },
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
