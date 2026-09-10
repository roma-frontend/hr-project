/**
 * Tests for convex/candidatePortal.ts — the public token-scoped candidate
 * dashboard query and the token-generation mutation.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
}));

let handlers: Record<string, (ctx: any, args: any) => Promise<any>> = {};
{
  const mod = require('../../convex/candidatePortal');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
  handlers.generateCandidateToken = (mod as any).generateCandidateToken;
}

function makeCtx(
  opts: {
    docs?: Record<string, unknown>;
    tables?: Record<string, any[]>;
  } = {},
) {
  const docs = opts.docs ?? {};
  const tables = opts.tables ?? {};
  const patches: Array<[string, any]> = [];

  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const patch = jest.fn(async (id: string, fields: any) => {
    patches.push([id, fields]);
  });

  const query = jest.fn((table: string) => {
    const rows = tables[table] ?? [];
    const chain: any = {
      withIndex: () => chain,
      order: () => chain,
      take: jest.fn(async (n: number) => rows.slice(0, n)),
      first: jest.fn(async () => rows[0] ?? null),
    };
    return chain;
  });

  return { ctx: { db: { get, patch, query } }, get, patch, query, patches };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateCandidateToken', () => {
  it('returns a 32-character alphanumeric token', () => {
    const token = handlers.generateCandidateToken();
    expect(token).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it('produces different tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => handlers.generateCandidateToken()));
    expect(tokens.size).toBe(20);
  });
});

describe('getCandidatePortal', () => {
  const app = {
    _id: 'app1',
    candidateId: 'cand1',
    vacancyId: 'vac1',
    organizationId: 'org1',
    stage: 'interview',
    createdAt: 1,
    updatedAt: 2,
    screeningStartedAt: 3,
    screeningCompletedAt: 4,
    screeningInstructions: 'answer these',
    screeningScore: 88,
  };

  function fullCtx() {
    return makeCtx({
      docs: {
        cand1: { _id: 'cand1', name: 'Jane', telegramChatId: '555' },
        vac1: {
          _id: 'vac1',
          title: 'Engineer',
          department: 'Eng',
          location: 'Yerevan',
          description: 'Build things',
        },
        org1: { _id: 'org1', name: 'Acme' },
        iv1: { _id: 'iv1', name: 'Interviewer' },
        sc1: { _id: 'sc1', name: 'Scorecard Author' },
      },
      tables: {
        applications: [app],
        screeningResponses: [
          { _id: 'r1', message: 'hi', sender: 'candidate', createdAt: 10, aiScore: 7 },
        ],
        interviews: [
          {
            _id: 'iv1',
            interviewerId: 'iv1',
            type: 'video',
            round: 1,
            scheduledAt: 100,
            duration: 60,
            status: 'scheduled',
            location: 'Zoom',
            meetingLink: 'https://meet',
          },
        ],
        interviewScorecards: [
          {
            _id: 'sc1',
            interviewerId: 'sc1',
            overallScore: 9,
            recommendation: 'hire',
            summary: 'great',
            createdAt: 50,
          },
        ],
        applicationEvents: [
          { _id: 'ev1', fromStage: 'applied', toStage: 'interview', reason: 'fit', createdAt: 20 },
        ],
      },
    });
  }

  it('returns null for an unknown token', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.getCandidatePortal(ctx, { token: 'nope' })).resolves.toBeNull();
  });

  it('maps the full portal payload', async () => {
    const { ctx } = fullCtx();
    const result = await handlers.getCandidatePortal(ctx, { token: 'tok' });

    expect(result).toMatchObject({
      applicationId: 'app1',
      stage: 'interview',
      candidateName: 'Jane',
      telegramLinked: true,
      vacancyTitle: 'Engineer',
      vacancyDepartment: 'Eng',
      orgName: 'Acme',
    });
    expect(result.screeningResponses).toEqual([
      { _id: 'r1', message: 'hi', sender: 'candidate', createdAt: 10, aiScore: 7 },
    ]);
    expect(result.interviews[0]).toMatchObject({ interviewerName: 'Interviewer' });
    expect(result.scorecards[0]).toMatchObject({ interviewerName: 'Scorecard Author' });
    expect(result.timeline[0]).toMatchObject({ toStage: 'interview' });
  });

  it('falls back to placeholder names when records are missing', async () => {
    const { ctx } = makeCtx({ tables: { applications: [app] } });

    const result = await handlers.getCandidatePortal(ctx, { token: 'tok' });

    expect(result).toMatchObject({
      candidateName: 'Candidate',
      telegramLinked: false,
      vacancyTitle: 'Position',
      orgName: 'Company',
      screeningResponses: [],
      interviews: [],
      scorecards: [],
      timeline: [],
    });
  });

  it('falls back to "HR Team" when the interviewer user is missing', async () => {
    const { ctx } = makeCtx({
      tables: {
        applications: [app],
        interviews: [{ _id: 'iv1', interviewerId: 'ghost' }],
        interviewScorecards: [{ _id: 'sc1', interviewerId: 'ghost' }],
      },
    });

    const result = await handlers.getCandidatePortal(ctx, { token: 'tok' });

    expect(result.interviews[0].interviewerName).toBe('HR Team');
    expect(result.scorecards[0].interviewerName).toBe('HR Team');
  });
});

describe('generateToken', () => {
  it('throws when the application does not exist', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.generateToken(ctx, { applicationId: 'missing' })).rejects.toThrow(
      'Application not found',
    );
  });

  it('returns the existing token when present', async () => {
    const { ctx, patch } = makeCtx({ docs: { app1: { _id: 'app1', candidateToken: 'existing' } } });
    await expect(handlers.generateToken(ctx, { applicationId: 'app1' })).resolves.toBe('existing');
    expect(patch).not.toHaveBeenCalled();
  });

  it('generates and persists a new token', async () => {
    const { ctx, patch } = makeCtx({ docs: { app1: { _id: 'app1' } } });
    const token = await handlers.generateToken(ctx, { applicationId: 'app1' });
    expect(token).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(patch).toHaveBeenCalledWith('app1', { candidateToken: token });
  });
});
