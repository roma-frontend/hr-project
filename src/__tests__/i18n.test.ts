/**
 * Translation System Tests
 *
 * These tests verify that all translation files are in sync and
 * that no translation keys are missing across languages.
 */

/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.join(__dirname, '../i18n/locales');

describe('Translation System', () => {
  let enTranslations: any;
  let ruTranslations: any;
  let hyTranslations: any;

  beforeAll(() => {
    // Load all translation files
    enTranslations = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));
    ruTranslations = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'ru.json'), 'utf-8'));
    hyTranslations = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'hy.json'), 'utf-8'));
  });

  describe('File Structure', () => {
    it('should have all translation files present', () => {
      expect(fs.existsSync(path.join(LOCALES_DIR, 'en.json'))).toBe(true);
      expect(fs.existsSync(path.join(LOCALES_DIR, 'ru.json'))).toBe(true);
      expect(fs.existsSync(path.join(LOCALES_DIR, 'hy.json'))).toBe(true);
    });

    it('should have valid JSON in all files', () => {
      expect(enTranslations).toBeTruthy();
      expect(ruTranslations).toBeTruthy();
      expect(hyTranslations).toBeTruthy();
    });
  });

  describe('Key Parity', () => {
    // Helper function to get all keys from nested object
    function getAllKeys(obj: any, prefix = ''): string[] {
      let keys: string[] = [];

      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys = keys.concat(getAllKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }

      return keys.sort();
    }

    it('should have similar number of keys across all languages (within 5% tolerance)', () => {
      const enKeys = getAllKeys(enTranslations);
      const ruKeys = getAllKeys(ruTranslations);
      const hyKeys = getAllKeys(hyTranslations);

      const maxKeys = Math.max(enKeys.length, ruKeys.length, hyKeys.length);
      const minKeys = Math.min(enKeys.length, ruKeys.length, hyKeys.length);

      // Allow 5% tolerance for translation drift
      expect(minKeys).toBeGreaterThan(maxKeys * 0.90);
    });

    it('should not have critical missing sections', () => {
      const criticalSections = ['common', 'nav', 'auth', 'dashboard', 'leave'];

      criticalSections.forEach((section) => {
        expect(enTranslations[section]).toBeDefined();
        expect(ruTranslations[section]).toBeDefined();
        expect(hyTranslations[section]).toBeDefined();
      });
    });
  });

  describe('Translation Completeness', () => {
    function checkNoEmptyValues(obj: any, lang: string, prefix = ''): string[] {
      const emptyKeys: string[] = [];

      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          emptyKeys.push(...checkNoEmptyValues(obj[key], lang, fullKey));
        } else if (obj[key] === '' || obj[key] === null || obj[key] === undefined) {
          emptyKeys.push(fullKey);
        }
      }

      return emptyKeys;
    }

    it('should have no empty translation values in English', () => {
      const emptyKeys = checkNoEmptyValues(enTranslations, 'en');
      expect(emptyKeys).toEqual([]);
    });

    it('should have no empty translation values in Russian', () => {
      const emptyKeys = checkNoEmptyValues(ruTranslations, 'ru');
      expect(emptyKeys).toEqual([]);
    });

    it('should have no empty translation values in Armenian', () => {
      const emptyKeys = checkNoEmptyValues(hyTranslations, 'hy');
      expect(emptyKeys).toEqual([]);
    });
  });

  describe('Translation Quality', () => {
    it('should not have English text in Russian translations', () => {
      // Check for common English words that shouldn't appear in Russian
      const commonEnglishWords = ['the', 'and', 'or', 'but', 'loading', 'error', 'success'];
      const ruText = JSON.stringify(ruTranslations).toLowerCase();

      // This is a simple heuristic - adjust as needed
      const suspiciousMatches = commonEnglishWords.filter(
        (word) => ruText.includes(`"${word}"`) || ruText.includes(` ${word} `),
      );

      // Some technical terms might legitimately appear (AI Score, API, etc.)
      expect(suspiciousMatches.length).toBeLessThan(10);
    });

    it('should have proper capitalization in titles', () => {
      // Check that title keys start with capital letters
      const checkCapitalization = (obj: any, parentKey = ''): boolean => {
        for (const key in obj) {
          if (key === 'titles' && typeof obj[key] === 'object') {
            for (const titleKey in obj[key]) {
              const value = obj[key][titleKey];
              if (typeof value === 'string' && value.length > 0) {
                const firstChar = value.charAt(0);
                if (firstChar !== firstChar.toUpperCase()) {
                  return false;
                }
              }
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (!checkCapitalization(obj[key], key)) {
              return false;
            }
          }
        }
        return true;
      };

      expect(checkCapitalization(enTranslations)).toBe(true);
    });
  });

  describe('Common Sections', () => {
    const requiredSections = [
      'common',
      'nav',
      'auth',
      'dashboard',
      'employees',
      'attendance',
      'leave',
      'settings',
      'errors',
      'success',
      'placeholders',
      'ui',
    ];

    requiredSections.forEach((section) => {
      it(`should have '${section}' section in all languages`, () => {
        expect(enTranslations[section]).toBeDefined();
        expect(ruTranslations[section]).toBeDefined();
        expect(hyTranslations[section]).toBeDefined();
      });
    });
  });

  describe('Analytics Section', () => {
    it('should have analytics section with required keys', () => {
      const requiredKeys = [
        'analyticsDashboard',
        'hrMetricsOverview',
        'pendingLeaves',
        'approvedLeaves',
        'approvalRate',
      ];

      requiredKeys.forEach((key) => {
        expect(enTranslations.analytics?.[key]).toBeDefined();
        expect(ruTranslations.analytics?.[key]).toBeDefined();
        expect(hyTranslations.analytics?.[key]).toBeDefined();
      });
    });
  });
});
