/**
 * Tests for src/lib/ai/gemini.ts
 *
 * Covers provider selection (Gemini primary, Groq fallback), the failure
 * accumulation and the final throw when no provider is configured / all fail.
 */

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn(() => 'gemini-model')),
}));

jest.mock('@ai-sdk/groq', () => ({
  groq: jest.fn(() => 'groq-model'),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { log: jest.fn() },
}));

import { generateText } from 'ai';
import { logger } from '@/lib/logger';
import { generateWithFallback, hasGemini, GEMINI_MODEL } from '@/lib/ai/gemini';

const generateTextMock = generateText as jest.Mock;
const loggerMock = logger as unknown as { log: jest.Mock };

const originalGeminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

function setKeys(gemini?: string, groq?: string) {
  if (gemini === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = gemini;
  if (groq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = groq;
}

afterAll(() => {
  setKeys(originalGeminiKey, originalGroqKey);
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

describe('GEMINI_MODEL', () => {
  it('is a non-empty string', () => {
    expect(typeof GEMINI_MODEL).toBe('string');
    expect(GEMINI_MODEL.length).toBeGreaterThan(0);
  });
});

describe('hasGemini', () => {
  it('returns false when the key is missing', () => {
    expect(hasGemini()).toBe(false);
  });

  it('returns true when the key is present', () => {
    setKeys('test-key');
    expect(hasGemini()).toBe(true);
  });
});

describe('generateWithFallback', () => {
  it('uses Gemini and returns its text when configured', async () => {
    setKeys('gemini-key');
    generateTextMock.mockResolvedValueOnce({ text: 'hello from gemini' });

    const result = await generateWithFallback({ prompt: 'hi' });

    expect(result).toBe('hello from gemini');
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-model',
        prompt: 'hi',
        temperature: 0.7,
        maxOutputTokens: 3000,
      }),
    );
  });

  it('passes through system, temperature and maxTokens', async () => {
    setKeys('gemini-key');
    generateTextMock.mockResolvedValueOnce({ text: 'ok' });

    await generateWithFallback({
      prompt: 'p',
      system: 'you are helpful',
      temperature: 0.1,
      maxTokens: 42,
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'you are helpful',
        temperature: 0.1,
        maxOutputTokens: 42,
      }),
    );
  });

  it('falls back to Groq when Gemini throws', async () => {
    setKeys('gemini-key', 'groq-key');
    generateTextMock
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockResolvedValueOnce({ text: 'hello from groq' });

    const result = await generateWithFallback({ prompt: 'hi' });

    expect(result).toBe('hello from groq');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(loggerMock.log).toHaveBeenCalledWith(
      expect.stringContaining('Gemini failed, trying Groq'),
    );
  });

  it('skips Gemini when no key and goes straight to Groq', async () => {
    setKeys(undefined, 'groq-key');
    generateTextMock.mockResolvedValueOnce({ text: 'groq only' });

    const result = await generateWithFallback({ prompt: 'hi' });

    expect(result).toBe('groq only');
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'groq-model' }));
  });

  it('stringifies non-Error Gemini failures', async () => {
    setKeys('gemini-key', 'groq-key');
    generateTextMock.mockRejectedValueOnce('boom').mockResolvedValueOnce({ text: 'ok' });

    await generateWithFallback({ prompt: 'hi' });

    expect(loggerMock.log).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('throws when no provider is configured', async () => {
    setKeys();

    await expect(generateWithFallback({ prompt: 'hi' })).rejects.toThrow(/All AI providers failed/);
    await expect(generateWithFallback({ prompt: 'hi' })).rejects.toThrow(
      /no GOOGLE_GENERATIVE_AI_API_KEY/,
    );
    await expect(generateWithFallback({ prompt: 'hi' })).rejects.toThrow(/no GROQ_API_KEY/);
  });

  it('throws with both failures when Gemini and Groq both error', async () => {
    setKeys('gemini-key', 'groq-key');
    generateTextMock
      .mockRejectedValueOnce(new Error('gemini exploded'))
      .mockRejectedValueOnce(new Error('groq exploded'));

    await expect(generateWithFallback({ prompt: 'hi' })).rejects.toThrow(
      /Gemini → gemini exploded \| Groq → groq exploded/,
    );
  });

  it('throws when only Groq is configured and it fails', async () => {
    setKeys(undefined, 'groq-key');
    generateTextMock.mockRejectedValueOnce(new Error('nope'));

    await expect(generateWithFallback({ prompt: 'hi' })).rejects.toThrow(/Groq → nope/);
  });
});
