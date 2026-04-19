/**
 * Unit tests for Zod validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
  loginSchema,
  registerSchema,
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
  leaveRequestSchema,
  employeeSchema,
  profileSchema,
} from '@/lib/validations';

describe('Zod Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should validate valid email', () => {
      const result = emailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('nameSchema', () => {
    it('should validate valid name', () => {
      const result = nameSchema.safeParse('John Doe');
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 chars', () => {
      const result = nameSchema.safeParse('A');
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 chars', () => {
      const result = nameSchema.safeParse('A'.repeat(101));
      expect(result.success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should validate valid password', () => {
      const result = passwordSchema.safeParse('Password123');
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = passwordSchema.safeParse('Pass1');
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = passwordSchema.safeParse('password123');
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = passwordSchema.safeParse('PASSWORD123');
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = passwordSchema.safeParse('Passwordabc');
      expect(result.success).toBe(false);
    });
  });

  describe('phoneSchema', () => {
    it('should validate valid phone', () => {
      const result = phoneSchema.safeParse('+1234567890');
      expect(result.success).toBe(true);
    });

    it('should reject phone shorter than 10 digits', () => {
      const result = phoneSchema.safeParse('123');
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = loginSchema.safeParse({ password: 'password' });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate valid registration', () => {
      const result = registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when passwords do not match', () => {
      const result = registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Different',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short name', () => {
      const result = registerSchema.safeParse({
        name: 'A',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('leaveRequestSchema', () => {
    it('should validate valid leave request', () => {
      const result = leaveRequestSchema.safeParse({
        startDate: '2026-04-10',
        endDate: '2026-04-15',
        leaveType: 'vacation',
        reason: 'Going on vacation with family',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when end date is before start date', () => {
      const result = leaveRequestSchema.safeParse({
        startDate: '2026-04-15',
        endDate: '2026-04-10',
        leaveType: 'vacation',
        reason: 'Going on vacation',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short reason', () => {
      const result = leaveRequestSchema.safeParse({
        startDate: '2026-04-10',
        endDate: '2026-04-15',
        leaveType: 'vacation',
        reason: 'Short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('employeeSchema', () => {
    it('should validate valid employee', () => {
      const result = employeeSchema.safeParse({
        name: 'Jane Smith',
        email: 'jane@company.com',
        position: 'Developer',
        department: 'Engineering',
        role: 'employee',
        startDate: '2026-01-01',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing position', () => {
      const result = employeeSchema.safeParse({
        name: 'Jane Smith',
        email: 'jane@company.com',
        department: 'Engineering',
        role: 'employee',
        startDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('profileSchema', () => {
    it('should validate valid profile', () => {
      const result = profileSchema.safeParse({
        name: 'John Doe',
        phone: '+1234567890',
        position: 'Developer',
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const result = profileSchema.safeParse({
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid avatar URL', () => {
      const result = profileSchema.safeParse({
        name: 'John Doe',
        avatarUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });
});
