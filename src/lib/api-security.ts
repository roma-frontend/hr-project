/**
 * 🔐 API SECURITY MIDDLEWARE
 * Защита API эндпоинтов
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { sanitizeObject, containsSQLInjection, containsXSS, logSecurityEvent, SecurityEventType } from './security';

/**
 * Проверка аутентификации для API
 */
export async function requireAuth(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  return token;
}

/**
 * Проверка прав доступа
 */
export function requireRole(token: any, allowedRoles: string[]): boolean {
  return allowedRoles.includes(token.role);
}

/**
 * Валидация и санитизация тела запроса
 */
export async function validateRequestBody(request: NextRequest): Promise<{
  valid: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const body = await request.json();
    
    // Проверка на SQL инъекции во всех строковых полях
    const bodyString = JSON.stringify(body);
    if (containsSQLInjection(bodyString)) {
      logSecurityEvent({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: Date.now(),
        details: { body },
      });
      
      return {
        valid: false,
        error: 'Invalid input detected',
      };
    }
    
    // Проверка на XSS
    if (containsXSS(bodyString)) {
      logSecurityEvent({
        type: SecurityEventType.XSS_ATTEMPT,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: Date.now(),
        details: { body },
      });
      
      return {
        valid: false,
        error: 'Invalid input detected',
      };
    }
    
    // Санитизация данных
    const sanitized = sanitizeObject(body);
    
    return {
      valid: true,
      data: sanitized,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid JSON',
    };
  }
}

/**
 * API Rate Limiter (специфично для API)
 */
const apiRateLimits = new Map<string, { count: number; resetTime: number }>();

export function checkAPIRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = apiRateLimits.get(identifier);
  
  if (!record || now > record.resetTime) {
    apiRateLimits.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

/**
 * Обертка для защищенных API handlers
 */
export function withSecurity(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options?: {
    requireAuth?: boolean;
    allowedRoles?: string[];
    rateLimit?: { maxRequests: number; windowMs: number };
  }
) {
  return async (request: NextRequest, context?: any) => {
    // 1. Rate Limiting
    if (options?.rateLimit) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      const { allowed, remaining } = checkAPIRateLimit(
        ip,
        options.rateLimit.maxRequests,
        options.rateLimit.windowMs
      );
      
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'Retry-After': '60',
            },
          }
        );
      }
    }
    
    // 2. Authentication
    if (options?.requireAuth) {
      const token = await requireAuth(request);
      if (token instanceof NextResponse) return token;
      
      // 3. Authorization
      if (options.allowedRoles && !requireRole(token, options.allowedRoles)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }
    
    // 4. Валидация body для POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const validation = await validateRequestBody(request);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }
    
    // 5. Выполнение handler
    return handler(request, context);
  };
}
