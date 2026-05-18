import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const openrouter = process.env.OPENROUTER_API_KEY;

  return NextResponse.json({
    telegram: token ? `set (${token.slice(0, 5)}...${token.slice(-4)})` : 'NOT SET',
    convex: convexUrl ? 'set' : 'NOT SET',
    openrouter: openrouter ? `set (${openrouter.slice(0, 8)}...)` : 'NOT SET',
  });
}
