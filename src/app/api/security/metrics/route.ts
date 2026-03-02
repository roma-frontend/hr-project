import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Временное хранилище метрик (в продакшене используйте Redis/БД)
let securityMetrics = {
  blockedIPs: 0,
  rateLimitHits: 0,
  failedLogins: 0,
  anomalyScore: 0,
  lastIncident: null as { type: string; timestamp: number } | null,
};

export async function GET(request: NextRequest) {
  // Проверка аутентификации
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Проверка прав доступа (только админы)
  if (!['admin', 'superadmin'].includes(token.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(securityMetrics);
}

// Функция для обновления метрик (вызывается из middleware)
export function updateSecurityMetrics(update: Partial<typeof securityMetrics>) {
  securityMetrics = {
    ...securityMetrics,
    ...update,
  };
}
