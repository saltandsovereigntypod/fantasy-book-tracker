import type { User } from '@supabase/supabase-js';
import { saveLocalArchive, type V2ArchiveState } from './archive';
import { supabase } from './supabase';

export async function saveArchiveCloud(user: User, state: V2ArchiveState): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  saveLocalArchive(next);

  const payload = {
    state: { v2Archive: next },
    updated_at: next.updatedAt,
  };

  const { data: updated, error: updateError } = await supabase
    .from('archive_states')
    .update(payload)
    .eq('user_id', user.id)
    .select('user_id');

  if (updateError) throw updateError;
  if (updated && updated.length > 0) return;

  const { error: insertError } = await supabase
    .from('archive_states')
    .insert({ user_id: user.id, ...payload });

  if (insertError) throw insertError;
}
