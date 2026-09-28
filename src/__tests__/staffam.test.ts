import {
  validateVacancyForStaffAm,
  formatStaffAmPayload,
  STAFF_AM_EMPLOYMENT_MAP,
} from '../../convex/staffam';
import type { Id } from '../../convex/_generated/dataModel';

describe('Staff.am Integration Utilities', () => {
  describe('validateVacancyForStaffAm', () => {
    it('returns errors when required fields are missing or too short', () => {
      const invalid = {
        title: 'AB',
        description: 'Short',
        employmentType: 'full_time',
        requirements: 'Short',
      };
      const errors = validateVacancyForStaffAm(invalid);
      expect(errors.length).toBe(3);
      expect(errors[0]).toContain('Title');
      expect(errors[1]).toContain('Description');
      expect(errors[2]).toContain('Requirements');
    });

    it('returns empty array for valid vacancy', () => {
      const valid = {
        title: 'Senior Frontend Engineer',
        description:
          'We are seeking a seasoned frontend engineer with strong React & TypeScript expertise.',
        employmentType: 'full_time',
        requirements:
          '5+ years experience with modern JavaScript, CSS, and component architectures.',
        location: 'Yerevan, Armenia',
      };
      const errors = validateVacancyForStaffAm(valid);
      expect(errors).toHaveLength(0);
    });
  });

  describe('formatStaffAmPayload', () => {
    it('formats a vacancy into Staff.am expected structure', () => {
      const mockId = 'v12345' as Id<'vacancies'>;
      const vacancy = {
        _id: mockId,
        title: 'Full Stack Developer',
        department: 'Engineering',
        location: 'Yerevan, Armenia',
        employmentType: 'full_time',
        description: 'Building modern SaaS platforms and applications.',
        requirements: 'Node.js, Next.js, Postgres experience required.',
        salary: { min: 800000, max: 1200000, currency: 'AMD' },
      };

      const payload = formatStaffAmPayload(vacancy, 'Acme Corp');

      expect(payload.partner_job_id).toBe(mockId);
      expect(payload.company_name).toBe('Acme Corp');
      expect(payload.job_title).toBe('Full Stack Developer');
      expect(payload.category).toBe('Engineering');
      expect(payload.employment_term).toBe('Full-time');
      expect(payload.location).toBe('Yerevan, Armenia');
      expect(payload.salary).toEqual({ from: 800000, to: 1200000, currency: 'AMD' });
    });
  });
});
