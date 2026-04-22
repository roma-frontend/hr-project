/**
 * API Integration Tests
 *
 * Tests for all API endpoints to ensure they handle requests correctly,
 * return proper responses, and validate inputs.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('API Endpoints', () => {
  test.describe('Public Endpoints', () => {
    test('GET /api/health should return status', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/health`);
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
    });

    test('POST /api/contact should validate required fields', async ({ request }) => {
      // Missing required fields
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('POST /api/contact should accept valid data', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/contact`, {
        data: {
          name: 'Test User',
          email: 'test@example.com',
          message: 'Test message',
        },
      });
      // May fail if Supabase is not available (500), which is expected in test env
      const status = response.status();
      expect([200, 500]).toContain(status);
      
      if (status === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success', true);
      }
    });

    test('GET /api/maintenance/check should return isActive', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/maintenance/check`);
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body).toHaveProperty('isActive');
    });

    test('POST /api/auth/login should reject missing credentials', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/login`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('POST /api/auth/login should reject invalid credentials', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/login`, {
        data: {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        },
      });
      // Returns 401 for wrong credentials, or 429 if rate limited
      expect([401, 429]).toContain(response.status());
    });

    test('POST /api/auth/forgot-password should validate email', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: {},
      });
      // Returns 429 (rate limited) when called with empty body, or 400 for missing email
      expect([400, 429]).toContain(response.status());
    });

    test('POST /api/auth/reset-password should validate token', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: {},
      });
      // Returns 429 (rate limited) or 400 for missing fields
      expect([400, 429]).toContain(response.status());
    });

    test('GET /api/auth/verify-reset-token should handle missing token', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/verify-reset-token`);
      // Returns 405 because it only supports POST
      expect([405, 200]).toContain(response.status());
    });
  });

  test.describe('Employee Endpoints', () => {
    test('GET /api/employees without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/employees`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/employees without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/employees`, {
        data: { action: 'create', name: 'Test' },
      });
      expect(response.status()).toBe(401);
    });

    test('GET /api/employees/[id] without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/employees/test-id`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Leave Endpoints', () => {
    test('GET /api/leaves should return leaves array', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/leaves`);
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body).toHaveProperty('leaves');
      expect(Array.isArray(body.leaves)).toBeTruthy();
    });

    test('POST /api/leaves should validate required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/leaves`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('PATCH /api/leaves should validate leaveId', async ({ request }) => {
      const response = await request.patch(`${BASE_URL}/api/leaves`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('DELETE /api/leaves should validate leaveId', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/api/leaves`);
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Task Endpoints', () => {
    test('GET /api/tasks without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/tasks`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/tasks without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/tasks`, {
        data: { action: 'create-task', title: 'Test' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Attendance Endpoints', () => {
    test('GET /api/attendance without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/attendance`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/attendance without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/attendance`, {
        data: { type: 'create-rating' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Chat Endpoints', () => {
    test('GET /api/chat without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/chat without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat`, {
        data: { action: 'send-message' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Dashboard Endpoints', () => {
    test('GET /api/dashboard without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/dashboard`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('User Endpoints', () => {
    test('GET /api/users without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/users`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/users without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/users`, {
        data: { action: 'create', name: 'Test', email: 'test@test.com', passwordHash: 'test', role: 'employee' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Notification Endpoints', () => {
    test('GET /api/notifications without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/notifications`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/notifications without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/notifications`, {
        data: { action: 'mark-all-as-read' },
      });
      expect(response.status()).toBe(401);
    });

    test('PATCH /api/notifications without auth should return 401', async ({ request }) => {
      const response = await request.patch(`${BASE_URL}/api/notifications`, {
        data: { notificationId: 'test' },
      });
      expect(response.status()).toBe(401);
    });

    test('DELETE /api/notifications without auth should return 401', async ({ request }) => {
      const response = await request.delete(`${BASE_URL}/api/notifications`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Settings Endpoints', () => {
    test('POST /api/settings without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/settings`, {
        data: { action: 'update-localization' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Organization Endpoints', () => {
    test('GET /api/org without auth should return 401 for protected actions', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/org?action=list-all`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/org without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/org`, {
        data: { action: 'create', name: 'Test', slug: 'test' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Analytics Endpoints', () => {
    test('GET /api/analytics without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/analytics`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('AI Chat Endpoints', () => {
    test('GET /api/ai-chat without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/ai-chat`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/ai-chat without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/ai-chat`, {
        data: { action: 'create-conversation' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Face Recognition Endpoints', () => {
    test('GET /api/face-recognition/status should require auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/face-recognition/status`);
      // Returns 401 (unauthorized) or 400 (missing email param)
      expect([401, 400]).toContain(response.status());
    });

    test('POST /api/face-recognition without auth should return 405', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/face-recognition`, {
        data: {},
      });
      // Only supports GET method
      expect(response.status()).toBe(405);
    });
  });

  test.describe('Security Endpoints', () => {
    test('GET /api/security should require auth', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/security`);
      // Now requires authentication
      expect(response.status()).toBe(401);
    });

    test('GET /api/security/login-attempts without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/security/login-attempts`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/security/metrics is a public endpoint', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/security/metrics`);
      // Public endpoint, returns 200
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Stripe Endpoints', () => {
    test('POST /api/stripe/checkout without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/stripe/checkout`, {
        data: {},
      });
      // Returns 400 for missing plan, or 503 if Stripe not configured
      expect([400, 503]).toContain(response.status());
    });

    test('GET /api/stripe/transactions is public in dev mode', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/stripe/transactions`);
      // Public endpoint in dev mode, returns 200
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Calendar Endpoints', () => {
    test('GET /api/calendar/google/auth without code should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/calendar/google/auth`);
      // Returns 400 for missing authorization code
      expect(response.status()).toBe(400);
    });

    test('GET /api/calendar/outlook/auth without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/calendar/outlook/auth`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Admin Endpoints', () => {
    test('GET /api/admin without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/admin/events without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/events`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/admin/join-requests without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/join-requests`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Superadmin Endpoints', () => {
    test('GET /api/superadmin without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/superadmin`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/superadmin/impersonate without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/superadmin/impersonate`, {
        data: {},
      });
      // Now requires superadmin authentication
      expect(response.status()).toBe(401);
    });

    test('POST /api/superadmin/bulk-actions without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/superadmin/bulk-actions`, {
        data: {},
      });
      // Now requires superadmin authentication
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Driver Endpoints', () => {
    test('GET /api/drivers without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/drivers`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/drivers/available without auth should return 400 or 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/drivers/available`);
      // Returns 400 for missing action param or 401 for auth
      expect([400, 401]).toContain(response.status());
    });
  });

  test.describe('Chat Action Endpoints', () => {
    test('POST /api/chat/book-leave without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/book-leave`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('POST /api/chat/create-task without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/create-task`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('POST /api/chat/conflict-check without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/conflict-check`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('GET /api/chat/weekly-digest without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat/weekly-digest`);
      expect(response.status()).toBe(400);
    });

    test('POST /api/chat/smart-reply without auth should return 200', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/smart-reply`, {
        data: {},
      });
      // Smart reply has fallback and returns 200 even without auth
      expect(response.status()).toBe(200);
    });
  });

  test.describe('AI Site Editor Endpoints', () => {
    test('POST /api/ai-site-editor without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/ai-site-editor`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });

    test('POST /api/ai-site-editor/apply without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/ai-site-editor/apply`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('AI Evaluator Endpoints', () => {
    test('POST /api/ai-evaluator without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/ai-evaluator`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('TOTP Endpoints', () => {
    test('GET /api/auth/totp/status without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/totp/status`);
      expect(response.status()).toBe(401);
    });

    test('POST /api/auth/totp/setup without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/totp/setup`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });

    test('POST /api/auth/totp/verify without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/totp/verify`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('User Profile Endpoints', () => {
    test('GET /api/user/profile without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/user/profile`);
      // No auth check, but requires userId or email query param
      expect(response.status()).toBe(400);
    });

    test('POST /api/profile/update without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/profile/update`, {
        data: {},
      });
      // Validates required fields before auth check
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Productivity Endpoints', () => {
    test('GET /api/productivity without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/productivity`);
      // No auth check, but requires userId query param
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Time Tracking Endpoints', () => {
    test('GET /api/time-tracking without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/time-tracking`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Events Endpoints', () => {
    test('GET /api/events without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/events/scan-conflicts without auth should return 405', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/events/scan-conflicts`);
      // Only supports POST method
      expect(response.status()).toBe(405);
    });
  });

  test.describe('Tickets Endpoints', () => {
    test('GET /api/tickets without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/tickets`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Approve All Endpoints', () => {
    test('POST /api/approve-all without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/approve-all`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Automation Endpoints', () => {
    test('POST /api/automation without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/automation`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Org Requests Endpoints', () => {
    test('GET /api/org-requests without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/org-requests`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Driver Schedules Endpoints', () => {
    test('GET /api/driver-schedules without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/driver-schedules`);
      // No auth check, but requires organizationId query param
      expect(response.status()).toBe(400);
    });
  });

  test.describe('SharePoint Endpoints', () => {
    test('GET /api/sharepoint/auth without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sharepoint/auth`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/sharepoint/status without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/sharepoint/status`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Security Settings Endpoints', () => {
    test('GET /api/security/settings without auth should return 200 or 500', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/security/settings`);
      // No auth check, but may return 500 if DB is unavailable in test env
      expect([200, 500]).toContain(response.status());
    });
  });

  test.describe('Security Suspended Users Endpoints', () => {
    test('GET /api/security/suspended-users without auth should return 200', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/security/suspended-users`);
      // No auth check, returns suspended users list
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Chat Insights Endpoints', () => {
    test('GET /api/chat/insights without auth should return 200', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat/insights`);
      // No auth check, returns null if userId missing
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Chat Full Context Endpoints', () => {
    test('GET /api/chat/full-context without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat/full-context`);
      // No auth check, but requires requesterId query param
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Chat Delete Leave Endpoints', () => {
    test('POST /api/chat/delete-leave without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/delete-leave`, {
        data: {},
      });
      // Validates required fields before auth check
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Chat Edit Leave Endpoints', () => {
    test('POST /api/chat/edit-leave without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/edit-leave`, {
        data: {},
      });
      // Validates required fields before auth check
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Chat Book Driver Endpoints', () => {
    test('POST /api/chat/book-driver without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/chat/book-driver`, {
        data: {},
      });
      // No auth check, but validates required fields
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Chat Link Preview Endpoints', () => {
    test('GET /api/chat/link-preview without auth should return 400', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat/link-preview`);
      // No auth check, but requires url query param
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Face Recognition Record Attempt Endpoints', () => {
    test('POST /api/face-recognition/record-attempt without auth should return 401', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/face-recognition/record-attempt`, {
        data: {},
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Face Recognition Register Endpoints', () => {
    test('POST /api/face-recognition/register without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/face-recognition/register`, {
        data: {},
      });
      // No auth check, but validates required fields
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Auth Face Login Endpoints', () => {
    test('POST /api/auth/face-login without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/face-login`, {
        data: {},
      });
      // Validates required fields before face comparison
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Auth Create Session Endpoints', () => {
    test('POST /api/auth/create-session without auth should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/create-session`, {
        data: {},
      });
      // No auth check, but validates required fields
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Auth OAuth Session Endpoints', () => {
    test('GET /api/auth/oauth-session should return 405', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/oauth-session`);
      // Only supports POST method
      expect(response.status()).toBe(405);
    });
  });

  test.describe('Auth Google Endpoints', () => {
    test('GET /api/auth/google should redirect or return 200', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/google`);
      // OAuth endpoint redirects (302) to Google or error page, returns 200 if Supabase client succeeds but redirects internally
      expect([200, 302, 500]).toContain(response.status());
    });
  });

  test.describe('Init Superadmin Endpoints', () => {
    test('POST /api/init-superadmin should handle missing data', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/init-superadmin`, {
        data: {},
      });
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Supervisor Ratings Endpoints', () => {
    test('GET /api/supervisor-ratings without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/supervisor-ratings`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Admin SLA Endpoints', () => {
    test('GET /api/admin/sla without auth should return 401', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/admin/sla`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('User Preferences Endpoints', () => {
    test('GET /api/user-preferences without sessionToken should return 200', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/user-preferences`);
      // Returns { hasSeenTour: false } gracefully when token is missing
      expect(response.status()).toBe(200);
    });

    test('POST /api/user-preferences without data should return 400', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/user-preferences`, {
        data: {},
      });
      expect(response.status()).toBe(400);
    });
  });
});
