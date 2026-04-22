-- =====================================================
-- HR Platform - Superadmin Initialization
-- This script ensures the superadmin account always exists
-- Run this after migrations to guarantee superadmin access
-- =====================================================

-- Create default superadmin organization if it doesn't exist
INSERT INTO organizations (
  id, name, slug, plan, is_active, created_by_superadmin, employee_limit, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'HR Platform',
  'hr-platform',
  'enterprise',
  true,
  true,
  10000,
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  EXTRACT(EPOCH FROM NOW())::BIGINT
) ON CONFLICT (id) DO NOTHING;

-- Create superadmin user (romangulanyan@gmail.com) if it doesn't exist
-- This ensures the superadmin can ALWAYS log in
INSERT INTO users (
  id, organization_id, name, email, password_hash, role, employee_type,
  is_active, is_approved, travel_allowance, paid_leave_balance,
  sick_leave_balance, family_leave_balance, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Roman Gulanyan',
  'romangulanyan@gmail.com',
  '$2b$10$placeholder-hash-for-superadmin123',
  'superadmin',
  'staff',
  true,
  true,
  9999,
  999,
  999,
  999,
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  EXTRACT(EPOCH FROM NOW())::BIGINT
) ON CONFLICT (id) DO UPDATE SET
  role = 'superadmin',
  is_active = true,
  is_approved = true;
