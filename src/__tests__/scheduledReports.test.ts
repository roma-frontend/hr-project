import { calculateNextRunAt } from '../../convex/scheduledReports';

describe('Scheduled Reports Utilities', () => {
  describe('calculateNextRunAt', () => {
    it('calculates daily run for tomorrow if time already passed', () => {
      // 2026-09-28 10:00 UTC
      const baseTime = Date.UTC(2026, 8, 28, 10, 0, 0);
      const nextRun = calculateNextRunAt('daily', '09:00', undefined, undefined, baseTime);

      const nextDate = new Date(nextRun);
      expect(nextDate.getUTCDate()).toBe(29);
      expect(nextDate.getUTCHours()).toBe(9);
      expect(nextDate.getUTCMinutes()).toBe(0);
    });

    it('calculates daily run for today if time has not passed yet', () => {
      // 2026-09-28 08:00 UTC
      const baseTime = Date.UTC(2026, 8, 28, 8, 0, 0);
      const nextRun = calculateNextRunAt('daily', '09:00', undefined, undefined, baseTime);

      const nextDate = new Date(nextRun);
      expect(nextDate.getUTCDate()).toBe(28);
      expect(nextDate.getUTCHours()).toBe(9);
      expect(nextDate.getUTCMinutes()).toBe(0);
    });

    it('calculates weekly run correctly on specified day of week', () => {
      // 2026-09-28 is a Monday (1)
      const baseTime = Date.UTC(2026, 8, 28, 12, 0, 0);
      // Next Friday (5) at 09:00
      const nextRun = calculateNextRunAt('weekly', '09:00', 5, undefined, baseTime);

      const nextDate = new Date(nextRun);
      expect(nextDate.getUTCDay()).toBe(5); // Friday
      expect(nextDate.getUTCHours()).toBe(9);
      expect(nextDate.getTime()).toBeGreaterThan(baseTime);
    });
  });
});
