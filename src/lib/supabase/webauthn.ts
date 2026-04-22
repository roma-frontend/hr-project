import { supabase } from '@/lib/supabase/client';

export async function registerWebauthnCredential(
  userId: string,
  credentialId: string,
  publicKey: string,
  deviceName?: string
) {
  const now = Math.floor(Date.now() / 1000);

  const { data, error } = await supabase
    .from('webauthn_credentials')
    .insert({
      userid: userId,
      credentialid: credentialId,
      public_key: publicKey,
      counter: 0,
      device_name: deviceName,
      created_at: now,
      last_used_at: now,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getWebauthnCredential(credentialId: string) {
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('*')
    .eq('credentialid', credentialId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function updateWebauthnCounter(credentialId: string, newCounter: number) {
  const { error } = await supabase
    .from('webauthn_credentials')
    .update({ counter: newCounter, last_used_at: Math.floor(Date.now() / 1000) })
    .eq('credentialid', credentialId);

  if (error) throw error;
}

export async function setWebauthnChallenge(userId: string, challenge: string) {
  const { error } = await supabase
    .from('users')
    .update({ webauthn_challenge: challenge })
    .eq('id', userId);

  if (error) throw error;
}

export async function getWebauthnChallenge(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('webauthn_challenge')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return data?.webauthn_challenge || null;
}

export async function clearWebauthnChallenge(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ webauthn_challenge: null })
    .eq('id', userId);

  if (error) throw error;
}
