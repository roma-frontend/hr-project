/**
 * Coverage for convex/meetings.ts — queries, host-guarded recording mutations,
 * lobby/registration flows and room-booking creation.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
  assertQuota: jest.fn(async () => undefined),
  currentPeriodKey: jest.fn(() => '2026-09'),
  incrementUsage: jest.fn(async () => undefined),
}));

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const isSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock;
const entitlements = jest.requireMock('../../convex/lib/entitlements') as Record<string, jest.Mock>;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};
let roomNameForEvent: (id: string) => string;
let videoUrlForRoom: (name: string) => string;
{
  const mod = require('../../convex/meetings');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
  roomNameForEvent = (mod as any).roomNameForEvent;
  videoUrlForRoom = (mod as any).videoUrlForRoom;
}

const ORG = 'org1';
const CALLER_ID = 'caller1';

function callerDoc(overrides: Record<string, unknown> = {}) {
  return { _id: CALLER_ID, name: 'Host', role: 'employee', organizationId: ORG, ...overrides };
}

function meetingDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'm1',
    roomName: 'evt_e1',
    organizationId: ORG,
    hostUserId: CALLER_ID,
    status: 'scheduled',
    mode: 'meeting',
    waitingRoomEnabled: false,
    registrationEnabled: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCtx(opts: { docs?: Record<string, unknown>; tables?: Record<string, any[]> } = {}) {
  const docs = opts.docs ?? {};
  const tables = opts.tables ?? {};
  const inserts: Array<[string, any]> = [];
  const patches: Array<[string, any]> = [];
  const deletes: string[] = [];

  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const insert = jest.fn(async (table: string, doc: any) => {
    inserts.push([table, doc]);
    return `${table}_new`;
  });
  const patch = jest.fn(async (id: string, fields: any) => {
    patches.push([id, fields]);
  });
  const remove = jest.fn(async (id: string) => {
    deletes.push(id);
  });

  const query = jest.fn((table: string) => {
    const rows = tables[table] ?? [];
    const filters: Record<string, unknown> = {};
    const makeQ = (): any =>
      new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === 'field') return (name: string) => name;
            if (prop === 'eq') {
              return (k: string, v: unknown) => {
                filters[k] = v;
                return makeQ();
              };
            }
            return (...args: unknown[]) => {
              void args;
              return makeQ();
            };
          },
        },
      );
    const matched = () => rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
    const chain: any = {
      withIndex: (_n: string, cb?: (q: unknown) => unknown) => {
        if (cb) cb(makeQ());
        return chain;
      },
      filter: (cb?: (q: unknown) => unknown) => {
        if (cb) cb(makeQ());
        return chain;
      },
      order: () => chain,
      take: jest.fn(async (n: number) => matched().slice(0, n)),
      collect: jest.fn(async () => matched()),
      first: jest.fn(async () => matched()[0] ?? null),
      unique: jest.fn(async () => matched()[0] ?? null),
    };
    return chain;
  });

  return {
    ctx: { db: { get, insert, patch, delete: remove, query } },
    get,
    insert,
    patch,
    remove,
    query,
    inserts,
    patches,
    deletes,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAuthCaller.mockResolvedValue(callerDoc());
  isSuperadmin.mockReturnValue(false);
  entitlements.assertModuleAccess.mockResolvedValue(undefined);
  entitlements.assertQuota.mockResolvedValue(undefined);
  entitlements.currentPeriodKey.mockReturnValue('2026-09');
  entitlements.incrementUsage.mockResolvedValue(undefined);
});

describe('pure name helpers', () => {
  it('derives a stable room name from an event id', () => {
    expect(roomNameForEvent('e1')).toBe('evt_e1');
  });
  it('derives a relative join url', () => {
    expect(videoUrlForRoom('evt_e1')).toBe('/meetings/evt_e1');
  });
});

describe('configuration queries', () => {
  const orig = {
    url: process.env.LIVEKIT_URL,
    key: process.env.LIVEKIT_API_KEY,
    secret: process.env.LIVEKIT_API_SECRET,
  };

  afterEach(() => {
    process.env.LIVEKIT_URL = orig.url;
    process.env.LIVEKIT_API_KEY = orig.key;
    process.env.LIVEKIT_API_SECRET = orig.secret;
  });

  it('reports livekitConfigured false without credentials', async () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    await expect(handlers.livekitConfigured({}, {})).resolves.toBe(false);
  });

  it('reports livekitConfigured true with credentials', async () => {
    process.env.LIVEKIT_URL = 'wss://x';
    process.env.LIVEKIT_API_KEY = 'k';
    process.env.LIVEKIT_API_SECRET = 's';
    await expect(handlers.livekitConfigured({}, {})).resolves.toBe(true);
  });

  it('reports recordingConfigured false without storage', async () => {
    process.env.LIVEKIT_URL = 'wss://x';
    process.env.LIVEKIT_API_KEY = 'k';
    process.env.LIVEKIT_API_SECRET = 's';
    delete process.env.LIVEKIT_EGRESS_S3_BUCKET;
    delete process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY;
    delete process.env.LIVEKIT_EGRESS_S3_SECRET;
    const result = await handlers.recordingConfigured({}, {});
    expect(result).toEqual({ configured: false, livekit: true, storage: false });
  });
});

describe('getByRoomName', () => {
  it('returns null when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.getByRoomName(ctx, { roomName: 'x' })).resolves.toBeNull();
  });

  it('returns the full row for an authenticated org member', async () => {
    const { ctx } = makeCtx({
      docs: {
        m1: meetingDoc({ eventId: 'e1' }),
        e1: { _id: 'e1', title: 'Event' },
        caller1: callerDoc({ name: 'Host' }),
      },
      tables: { meetings: [meetingDoc({ eventId: 'e1' })] },
    });

    const result = await handlers.getByRoomName(ctx, { roomName: 'evt_e1' });

    expect(result).toMatchObject({ _id: 'm1', hostName: 'Host', isOriginalHost: true });
    expect(result.event).toMatchObject({ _id: 'e1' });
  });

  it('returns null for an authenticated caller from another organization', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.getByRoomName(ctx, { roomName: 'evt_e1' })).resolves.toBeNull();
  });

  it('flags a co-host', async () => {
    const { ctx } = makeCtx({
      docs: { caller1: callerDoc() },
      tables: { meetings: [meetingDoc({ cohostIds: [CALLER_ID], hostUserId: 'other' })] },
    });
    const result = await handlers.getByRoomName(ctx, { roomName: 'evt_e1' });
    expect(result.isCohost).toBe(true);
    expect(result.isOriginalHost).toBe(false);
  });

  it('returns the trimmed public payload for a visitor', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx({
      docs: { caller1: callerDoc({ name: 'Host' }) },
      tables: { meetings: [meetingDoc()] },
    });

    const result = await handlers.getByRoomName(ctx, { roomName: 'evt_e1' });

    expect(result).toMatchObject({ roomName: 'evt_e1', hostName: 'Host' });
    expect(result).not.toHaveProperty('hostUserId');
  });

  it('applies default registration fields for a visitor', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx({
      tables: { meetings: [meetingDoc({ registrationFields: undefined })] },
    });
    const result = await handlers.getByRoomName(ctx, { roomName: 'evt_e1' });
    expect(result.registrationFields).toEqual([
      { name: 'fullName', required: true },
      { name: 'email', required: true },
    ]);
  });
});

describe('getByEvent', () => {
  it('returns null without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getByEvent(ctx, { eventId: 'e1' })).resolves.toBeNull();
  });

  it('returns null when missing or cross-org', async () => {
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.getByEvent(ctx, { eventId: 'e1' })).resolves.toBeNull();

    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    await expect(handlers.getByEvent(ctx, { eventId: 'e1' })).resolves.toBeNull();
  });

  it('returns the meeting for the same org', async () => {
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc({ eventId: 'e1' })] } });
    const result = await handlers.getByEvent(ctx, { eventId: 'e1' });
    expect(result).toMatchObject({ _id: 'm1' });
  });
});

describe('listByOrganization', () => {
  it('returns [] without a caller or for another org', async () => {
    const { ctx } = makeCtx();
    getAuthCaller.mockResolvedValue(null);
    await expect(handlers.listByOrganization(ctx, { organizationId: ORG })).resolves.toEqual([]);

    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    await expect(handlers.listByOrganization(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('returns the meetings for the caller org', async () => {
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    const result = await handlers.listByOrganization(ctx, { organizationId: ORG });
    expect(result).toHaveLength(1);
  });
});

describe('register', () => {
  const base = { eventId: 'e1', organizationId: ORG, roomName: 'evt_e1', mode: 'meeting' };

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.register(ctx, base)).rejects.toThrow('Not authenticated');
  });

  it('rejects a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.register(ctx, base)).rejects.toThrow('different organization');
  });

  it('throws when the event is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.register(ctx, base)).rejects.toThrow('Event not found');
  });

  it('rejects a non-organizer, non-admin caller', async () => {
    const { ctx } = makeCtx({ docs: { e1: { _id: 'e1', createdBy: 'someone-else' } } });
    await expect(handlers.register(ctx, base)).rejects.toThrow('Only the organizer');
  });

  it('creates a meeting, links the event and consumes quota', async () => {
    const { ctx, insert, patch } = makeCtx({
      docs: { e1: { _id: 'e1', createdBy: CALLER_ID } },
    });

    const result = await handlers.register(ctx, base);

    expect(result).toEqual({ success: true });
    expect(entitlements.assertQuota).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      'meetings',
      expect.objectContaining({ roomName: 'evt_e1', status: 'scheduled' }),
    );
    expect(patch).toHaveBeenCalledWith('e1', expect.objectContaining({ videoProvider: 'livekit' }));
    expect(entitlements.incrementUsage).toHaveBeenCalled();
  });

  it('patches an existing meeting without touching quota', async () => {
    const { ctx, patch } = makeCtx({
      docs: { e1: { _id: 'e1', createdBy: CALLER_ID } },
      tables: { meetings: [meetingDoc({ eventId: 'e1' })] },
    });

    await handlers.register(ctx, { ...base, waitingRoomEnabled: true, registrationEnabled: true });

    expect(entitlements.assertQuota).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ waitingRoomEnabled: true }));
  });

  it('adds fullName to registration fields when absent', async () => {
    const { ctx, insert } = makeCtx({ docs: { e1: { _id: 'e1', createdBy: CALLER_ID } } });
    await handlers.register(ctx, {
      ...base,
      registrationFields: [{ name: 'email', required: true }],
    });
    expect(insert).toHaveBeenCalledWith(
      'meetings',
      expect.objectContaining({
        registrationFields: [
          { name: 'email', required: true },
          { name: 'fullName', required: true },
        ],
      }),
    );
  });
});

describe('setStatus', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.setStatus(ctx, { roomName: 'x', status: 'live' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.setStatus(ctx, { roomName: 'x', status: 'live' })).rejects.toThrow(
      'Meeting not found',
    );
  });

  it('rejects a cross-org caller', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.setStatus(ctx, { roomName: 'evt_e1', status: 'live' })).rejects.toThrow(
      'different organization',
    );
  });

  it('rejects a non-host non-admin', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.setStatus(ctx, { roomName: 'evt_e1', status: 'live' })).rejects.toThrow(
      'Only the host or an admin',
    );
  });

  it('lets an admin change the status', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'admin2', role: 'admin' }));
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await handlers.setStatus(ctx, { roomName: 'evt_e1', status: 'live' });
    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ status: 'live' }));
  });

  it('lets the host change the status', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await handlers.setStatus(ctx, { roomName: 'evt_e1', status: 'ended' });
    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ status: 'ended' }));
  });
});

describe('recording host gate', () => {
  it('markRecordingStarted rejects a non-host', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(
      handlers.markRecordingStarted(ctx, { roomName: 'evt_e1', egressId: 'eg', filepath: 'f' }),
    ).rejects.toThrow('control the recording');
  });

  it('markRecordingStarted writes the egress state', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    const result = await handlers.markRecordingStarted(ctx, {
      roomName: 'evt_e1',
      egressId: 'eg',
      filepath: 'file.mp4',
    });
    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ egressId: 'eg', recordingFilepath: 'file.mp4' }),
    );
  });

  it('markRecordingStopped leaves a pointer to the uploaded file', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc({ eventId: 'e1' })] } });
    const result = await handlers.markRecordingStopped(ctx, {
      roomName: 'evt_e1',
      recordingUrl: 'https://rec',
    });
    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ egressId: undefined }));
    expect(patch).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ videoRecordingUrl: 'https://rec' }),
    );
  });

  it('markRecordingStopped skips the event patch without a recording url', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc({ eventId: 'e1' })] } });
    await handlers.markRecordingStopped(ctx, { roomName: 'evt_e1' });
    expect(patch).not.toHaveBeenCalledWith('e1', expect.anything());
  });

  it('markRecordingStarted rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.markRecordingStarted(ctx, { roomName: 'x', egressId: 'eg', filepath: 'f' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('markRecordingStarted throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.markRecordingStarted(ctx, { roomName: 'x', egressId: 'eg', filepath: 'f' }),
    ).rejects.toThrow('Meeting not found');
  });

  it('markRecordingStarted rejects a cross-org caller', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(
      handlers.markRecordingStarted(ctx, { roomName: 'evt_e1', egressId: 'eg', filepath: 'f' }),
    ).rejects.toThrow('different organization');
  });
});

describe('setRecording', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.setRecording(ctx, { roomName: 'x', recordingUrl: 'r' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.setRecording(ctx, { roomName: 'x', recordingUrl: 'r' })).rejects.toThrow(
      'Meeting not found',
    );
  });

  it('rejects a cross-org caller', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(
      handlers.setRecording(ctx, { roomName: 'evt_e1', recordingUrl: 'r' }),
    ).rejects.toThrow('different organization');
  });

  it('attaches the recording to the event', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc({ eventId: 'e1' })] } });
    await handlers.setRecording(ctx, { roomName: 'evt_e1', recordingUrl: 'https://rec' });
    expect(patch).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ videoRecordingUrl: 'https://rec' }),
    );
  });

  it('handles a meeting with no event', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await handlers.setRecording(ctx, { roomName: 'evt_e1', recordingUrl: 'https://rec' });
    expect(patch).toHaveBeenCalledTimes(1);
  });
});

describe('removeVideo', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.removeVideo(ctx, { eventId: 'e1' })).rejects.toThrow('Not authenticated');
  });

  it('throws when the event is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.removeVideo(ctx, { eventId: 'e1' })).rejects.toThrow('Event not found');
  });

  it('rejects a non-organizer', async () => {
    const { ctx } = makeCtx({ docs: { e1: { _id: 'e1', createdBy: 'other' } } });
    await expect(handlers.removeVideo(ctx, { eventId: 'e1' })).rejects.toThrow(
      'Only the organizer',
    );
  });

  it('clears the video link', async () => {
    const { ctx, patch } = makeCtx({ docs: { e1: { _id: 'e1', createdBy: CALLER_ID } } });
    await handlers.removeVideo(ctx, { eventId: 'e1' });
    expect(patch).toHaveBeenCalledWith('e1', expect.objectContaining({ videoUrl: undefined }));
  });
});

describe('setCohostIds', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.setCohostIds(ctx, { roomName: 'x', cohostIds: [] })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.setCohostIds(ctx, { roomName: 'x', cohostIds: [] })).rejects.toThrow(
      'Meeting not found',
    );
  });

  it('rejects a non-host', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.setCohostIds(ctx, { roomName: 'evt_e1', cohostIds: [] })).rejects.toThrow(
      'change co-hosts',
    );
  });

  it('sets and clears the co-host list', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    const withCo = await handlers.setCohostIds(ctx, { roomName: 'evt_e1', cohostIds: ['u2'] });
    expect(withCo).toEqual({ success: true, cohostIds: ['u2'] });
    expect(patch).toHaveBeenCalledWith('m1', expect.objectContaining({ cohostIds: ['u2'] }));

    await handlers.setCohostIds(ctx, { roomName: 'evt_e1', cohostIds: [] });
    expect(patch).toHaveBeenLastCalledWith('m1', expect.objectContaining({ cohostIds: undefined }));
  });
});

describe('submitRegistration', () => {
  it('throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.submitRegistration(ctx, { roomName: 'x', fullName: 'A' }),
    ).rejects.toThrow('Meeting not found');
  });

  it('refuses when neither registration nor waiting room is on', async () => {
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(
      handlers.submitRegistration(ctx, { roomName: 'evt_e1', fullName: 'A' }),
    ).rejects.toThrow('does not require registration');
  });

  it('accepts a waiting-room-only submission', async () => {
    const { ctx, insert } = makeCtx({
      tables: { meetings: [meetingDoc({ waitingRoomEnabled: true })] },
    });
    const result = await handlers.submitRegistration(ctx, { roomName: 'evt_e1', fullName: 'Anna' });
    expect(result.deduped).toBe(false);
    expect(insert).toHaveBeenCalledWith(
      'meetingRegistrations',
      expect.objectContaining({ fullName: 'Anna' }),
    );
  });

  it('requires a full name', async () => {
    const { ctx } = makeCtx({
      tables: { meetings: [meetingDoc({ registrationEnabled: true })] },
    });
    await expect(
      handlers.submitRegistration(ctx, { roomName: 'evt_e1', fullName: '   ' }),
    ).rejects.toThrow('Full name is required');
  });

  it('enforces a required configured field', async () => {
    const { ctx } = makeCtx({
      tables: {
        meetings: [
          meetingDoc({
            registrationEnabled: true,
            registrationFields: [{ name: 'email', required: true }],
          }),
        ],
      },
    });
    await expect(
      handlers.submitRegistration(ctx, { roomName: 'evt_e1', fullName: 'A' }),
    ).rejects.toThrow('email is required');
  });

  it('dedupes by visitor id', async () => {
    const { ctx, insert } = makeCtx({
      tables: {
        meetings: [meetingDoc({ waitingRoomEnabled: true })],
        meetingRegistrations: [{ _id: 'r1', roomName: 'evt_e1', visitorId: 'v1', fullName: 'A' }],
      },
    });
    const result = await handlers.submitRegistration(ctx, {
      roomName: 'evt_e1',
      fullName: 'A',
      visitorId: 'v1',
    });
    expect(result).toEqual({ registrationId: 'r1', deduped: true });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('listPending / listRegistrations', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.listPending(ctx, { roomName: 'x' })).resolves.toEqual([]);
    await expect(handlers.listRegistrations(ctx, { roomName: 'x' })).resolves.toEqual([]);
  });

  it('returns [] when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.listPending(ctx, { roomName: 'x' })).resolves.toEqual([]);
  });

  it('returns [] for a non-host member', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.listPending(ctx, { roomName: 'evt_e1' })).resolves.toEqual([]);
  });

  it('returns the registrations for the host', async () => {
    const { ctx } = makeCtx({
      tables: {
        meetings: [meetingDoc()],
        meetingRegistrations: [{ _id: 'r1', roomName: 'evt_e1' }],
      },
    });
    const pending = await handlers.listPending(ctx, { roomName: 'evt_e1' });
    const all = await handlers.listRegistrations(ctx, { roomName: 'evt_e1' });
    expect(pending).toHaveLength(1);
    expect(all).toHaveLength(1);
  });
});

describe('removeRegistration', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.removeRegistration(ctx, { registrationId: 'r1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('is a no-op for a missing registration', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.removeRegistration(ctx, { registrationId: 'missing' })).resolves.toEqual({
      success: true,
    });
  });

  it('deletes an orphaned registration when the meeting is gone', async () => {
    const { ctx, remove } = makeCtx({
      docs: { r1: { _id: 'r1', roomName: 'gone', visitorId: 'v' } },
    });
    await handlers.removeRegistration(ctx, { registrationId: 'r1' });
    expect(remove).toHaveBeenCalledWith('r1');
  });

  it('rejects a non-host', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({
      docs: { r1: { _id: 'r1', roomName: 'evt_e1' } },
      tables: { meetings: [meetingDoc()] },
    });
    await expect(handlers.removeRegistration(ctx, { registrationId: 'r1' })).rejects.toThrow(
      'manage the lobby',
    );
  });

  it('deletes the registration for the host', async () => {
    const { ctx, remove } = makeCtx({
      docs: { r1: { _id: 'r1', roomName: 'evt_e1' } },
      tables: { meetings: [meetingDoc()] },
    });
    const result = await handlers.removeRegistration(ctx, { registrationId: 'r1' });
    expect(result).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith('r1');
  });
});

describe('registration lookups', () => {
  it('getRegistrationById returns null for a missing row', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.getRegistrationById(ctx, { registrationId: 'missing' }),
    ).resolves.toBeNull();
  });

  it('getRegistrationById returns the room + name', async () => {
    const { ctx } = makeCtx({ docs: { r1: { _id: 'r1', roomName: 'evt_e1', fullName: 'A' } } });
    await expect(handlers.getRegistrationById(ctx, { registrationId: 'r1' })).resolves.toEqual({
      roomName: 'evt_e1',
      fullName: 'A',
    });
  });

  it('getRegistrationByVisitor returns null when missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.getRegistrationByVisitor(ctx, { roomName: 'x', visitorId: 'v' }),
    ).resolves.toBeNull();
  });

  it('getRegistrationByVisitor returns the admit state', async () => {
    const { ctx } = makeCtx({
      tables: {
        meetingRegistrations: [{ _id: 'r1', roomName: 'evt_e1', visitorId: 'v', admittedAt: 5 }],
      },
    });
    await expect(
      handlers.getRegistrationByVisitor(ctx, { roomName: 'evt_e1', visitorId: 'v' }),
    ).resolves.toEqual({ _id: 'r1', admittedAt: 5 });
  });

  it('getMyRegistration returns the raw row', async () => {
    const { ctx } = makeCtx({
      tables: { meetingRegistrations: [{ _id: 'r1', roomName: 'evt_e1', visitorId: 'v' }] },
    });
    const result = await handlers.getMyRegistration(ctx, { roomName: 'evt_e1', visitorId: 'v' });
    expect(result._id).toBe('r1');
  });
});

describe('updateLobbyAndRegistration', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.updateLobbyAndRegistration(ctx, { roomName: 'x' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the meeting is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.updateLobbyAndRegistration(ctx, { roomName: 'x' })).rejects.toThrow(
      'Meeting not found',
    );
  });

  it('rejects a non-host', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ _id: 'other' }));
    const { ctx } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await expect(handlers.updateLobbyAndRegistration(ctx, { roomName: 'evt_e1' })).rejects.toThrow(
      'change meeting settings',
    );
  });

  it('patches toggles and adds fullName to fields', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await handlers.updateLobbyAndRegistration(ctx, {
      roomName: 'evt_e1',
      waitingRoomEnabled: true,
      registrationEnabled: true,
      registrationFields: [{ name: 'phone', required: false }],
    });
    expect(patch).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        waitingRoomEnabled: true,
        registrationEnabled: true,
        registrationFields: [
          { name: 'phone', required: false },
          { name: 'fullName', required: true },
        ],
      }),
    );
  });

  it('keeps an explicit fullName field', async () => {
    const { ctx, patch } = makeCtx({ tables: { meetings: [meetingDoc()] } });
    await handlers.updateLobbyAndRegistration(ctx, {
      roomName: 'evt_e1',
      registrationFields: [{ name: 'fullName', required: true }],
    });
    expect(patch).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ registrationFields: [{ name: 'fullName', required: true }] }),
    );
  });
});

describe('createForRoomBooking', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.createForRoomBooking(ctx, { organizationId: ORG })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('rejects a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.createForRoomBooking(ctx, { organizationId: ORG })).rejects.toThrow(
      'different organization',
    );
  });

  it('creates a live room-booking meeting with a fresh name', async () => {
    const { ctx, insert } = makeCtx();
    const result = await handlers.createForRoomBooking(ctx, { organizationId: ORG });

    expect(result.roomName).toMatch(/^room_caller1_/);
    expect(result.videoUrl).toBe(`/meetings/${result.roomName}`);
    expect(entitlements.assertQuota).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      'meetings',
      expect.objectContaining({ mode: 'meeting', status: 'live' }),
    );
    expect(entitlements.incrementUsage).toHaveBeenCalled();
  });

  it('adds fullName to the registration fields when absent', async () => {
    const { ctx, insert } = makeCtx();
    await handlers.createForRoomBooking(ctx, {
      organizationId: ORG,
      registrationFields: [{ name: 'email', required: true }],
    });
    expect(insert).toHaveBeenCalledWith(
      'meetings',
      expect.objectContaining({
        registrationFields: [
          { name: 'email', required: true },
          { name: 'fullName', required: true },
        ],
      }),
    );
  });
});

describe('markRegistrationAdmitted', () => {
  it('writes the admit timestamp and token', async () => {
    const { ctx, patch } = makeCtx();
    await handlers.markRegistrationAdmitted(ctx, {
      registrationId: 'r1',
      admittedAt: 99,
      admitToken: 'tok',
    });
    expect(patch).toHaveBeenCalledWith('r1', { admittedAt: 99, admitToken: 'tok' });
  });
});
