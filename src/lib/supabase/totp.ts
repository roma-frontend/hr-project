import { supabase } from '@/lib/supabase/client';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { randomBytes } from 'crypto';

export async function generateTotpSecret(userId: string) {
  const secret = generateSecret();
  const now = Math.floor(Date.now() / 1000);

  const backupCodes = Array.from({ length: 10 }, () =>
    randomBytes(4).toString('hex').toUpperCase()
  );

  const { error } = await supabase
    .from('users')
    .update({
      totp_secret: secret,
      totp_enabled: false,
      backup_codes: backupCodes,
    })
    .eq('id', userId);

  if (error) throw error;

  return {
    secret,
    backupCodes,
    qrCodeUrl: generateURI({ label: userId, issuer: 'HR Platform', secret }),
  };
}

export async function verifyTotpCode(userId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('totp_secret, totp_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.totp_secret) return false;

  try {
    const result = verifySync({ token, secret: data.totp_secret });
    return result.valid;
  } catch {
    return false;
  }
}

export async function enableTotp(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ totp_enabled: true })
    .eq('id', userId);

  if (error) return false;
  return true;
}

export async function disableTotp(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({
      totp_enabled: false,
      totp_secret: null,
      backup_codes: null,
    })
    .eq('id', userId);

  if (error) return false;
  return true;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('backup_codes')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.backup_codes) return false;

  const backupCodes = data.backup_codes as string[];
  const codeIndex = backupCodes.findIndex(c => c === code.toUpperCase());

  if (codeIndex === -1) return false;

  backupCodes.splice(codeIndex, 1);

  const { error: updateError } = await supabase
    .from('users')
    .update({ backup_codes: backupCodes })
    .eq('id', userId);

  if (updateError) return false;
  return true;
}

export async function getTotpStatus(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('totp_enabled, totp_secret')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { enabled: false, configured: false };
  if (!data) return { enabled: false, configured: false };

  return {
    enabled: data.totp_enabled || false,
    configured: !!data.totp_secret,
  };
}
