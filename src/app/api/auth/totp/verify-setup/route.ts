import { NextRequest, NextResponse } from 'next/server';
import { verifySync } from 'otplib';
import { verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

async function getUserId(req: NextRequest, body: any): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('hr-auth-token')?.value;
  if (token) {
    const payload = await verifyJWT(token);
    if (payload) return payload.userId;
  }
  return body.userId || null;
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'TOTP is not implemented in this project' }, { status: 501 });
}
