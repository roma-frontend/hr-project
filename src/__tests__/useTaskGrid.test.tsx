/**
 * Tests for src/hooks/useTaskGrid.ts
 *
 * Convex queries/mutations, i18n and toasts are mocked. The hook is exercised
 * through its returned API: derived collections and every write handler.
 */
jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) =>
      typeof opts === 'string'
        ? opts
        : opts && typeof opts === 'object' && 'defaultValue' in opts
          ? (opts as { defaultValue?: string }).defaultValue
          : key,
  }),
}));

jest.mock('sonner', () => {
  const toast = jest.fn() as jest.Mock & { error: jest.Mock; success: jest.Mock };
  toast.error = jest.fn();
  toast.success = jest.fn();
  return { toast };
});

import { renderHook, act } from '@testing-library/react';
import { useQuery, useMutation } from 'convex/react';
import { getFunctionName } from 'convex/server';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { DEFAULT_STATUS_SET } from '../../convex/lib/taskStatus';
import { useTaskGrid, type TaskGridScope, type GridSourceTask } from '@/hooks/useTaskGrid';

const useQueryMock = useQuery as jest.Mock;
const useMutationMock = useMutation as jest.Mock;
const toastMock = toast as unknown as jest.Mock & { error: jest.Mock; success: jest.Mock };

// `convex`'s `api` is a Proxy that mints a fresh reference on every property
// access, so mutations must be keyed by the function's path name instead.
const mutations = new Map<string, jest.Mock>();

function mutationName(ref: unknown): string {
  return getFunctionName(ref as never);
}

function mutationDefaults(name: string): unknown {
  if (name === 'tasks:bulkUpdateTasks' || name === 'tasks:bulkDeleteTasks') return { skipped: 0 };
  if (name === 'tasks:createTask') return 'new-task';
  if (name === 'taskViews:saveView') return 'new-view';
  return undefined;
}

function ensureMut(ref: unknown): jest.Mock {
  const key = mutationName(ref);
  if (!mutations.has(key)) {
    mutations.set(
      key,
      jest.fn(async () => mutationDefaults(key)),
    );
  }
  return mutations.get(key) as jest.Mock;
}

function mut<T = unknown>(ref: unknown): jest.Mock<T> {
  return ensureMut(ref) as jest.Mock<T>;
}

function task(overrides: Partial<GridSourceTask> = {}): GridSourceTask {
  return { _id: 't1', status: 'pending', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mutations.clear();
  useQueryMock.mockReset();
  useMutationMock.mockImplementation((ref: unknown) => ensureMut(ref));
});

function setup(
  options: {
    statusSet?: unknown;
    fieldDefs?: unknown;
    savedViews?: unknown;
    scope?: TaskGridScope;
    tasks?: readonly GridSourceTask[];
  } = {},
) {
  useQueryMock
    .mockReturnValueOnce(options.statusSet)
    .mockReturnValueOnce(options.fieldDefs)
    .mockReturnValueOnce(options.savedViews);

  const scope = options.scope ?? { viewerId: 'viewer-1' };
  const tasks = options.tasks ?? [];
  return renderHook(() => useTaskGrid(scope, tasks));
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('useTaskGrid - query scope', () => {
  it('does not skip when a viewer is known', () => {
    setup({ scope: { viewerId: 'v1' } });
    expect(useQueryMock).toHaveBeenCalledTimes(3);
    expect(useQueryMock.mock.calls[0][1]).toEqual({});
  });

  it('skips the queries when there is no viewer and no explicit enabled', () => {
    setup({ scope: {} });
    expect(useQueryMock.mock.calls[0][1]).toBe('skip');
  });

  it('honours an explicit enabled flag', () => {
    setup({ scope: { enabled: true } });
    expect(useQueryMock.mock.calls[0][1]).toEqual({});
  });

  it('honours an explicit disabled flag even with a viewer', () => {
    setup({ scope: { viewerId: 'v1', enabled: false } });
    expect(useQueryMock.mock.calls[0][1]).toBe('skip');
  });

  it('passes organization and project scope through', () => {
    setup({ scope: { viewerId: 'v1', organizationId: 'org1', projectId: 'proj1' } });
    expect(useQueryMock.mock.calls[0][1]).toEqual({ organizationId: 'org1', projectId: 'proj1' });
  });
});

describe('useTaskGrid - derived config', () => {
  it('falls back to DEFAULT_STATUS_SET when no set is loaded', () => {
    const { result } = setup();
    expect(result.current.statuses).toBe(DEFAULT_STATUS_SET);
  });

  it('uses the resolved status set when loaded', () => {
    const statuses = [{ key: 'todo', label: 'To do' }];
    const { result } = setup({ statusSet: { statuses } });
    expect(result.current.statuses).toEqual(statuses);
  });

  it('defaults fields to an empty list', () => {
    const { result } = setup();
    expect(result.current.fields).toEqual([]);
  });

  it('builds a field map keyed by id', () => {
    const fields = [
      { _id: 'f1', name: 'Confidence', type: 'number' },
      { _id: 'f2', name: 'Owner', type: 'text' },
    ];
    const { result } = setup({ fieldDefs: fields });
    expect(result.current.fields).toEqual(fields);
    expect(result.current.fieldMap.get('f1')).toEqual(fields[0]);
    expect(result.current.fieldMap.get('f2')).toEqual(fields[1]);
  });

  it('maps saved views into tabs', () => {
    const savedViews = [
      {
        _id: 'v1',
        name: 'Mine',
        type: 'table',
        visibility: 'private',
        isDefault: true,
        canEdit: true,
        state: { foo: 1 },
      },
    ];
    const { result } = setup({ savedViews });
    expect(result.current.savedViews).toEqual(savedViews);
    expect(result.current.viewTabs).toEqual([
      {
        _id: 'v1',
        name: 'Mine',
        type: 'table',
        visibility: 'private',
        isDefault: true,
        canEdit: true,
      },
    ]);
  });

  it('returns empty view tabs when none are loaded', () => {
    const { result } = setup();
    expect(result.current.viewTabs).toEqual([]);
  });
});

describe('useTaskGrid - cell users', () => {
  it('deduplicates and sorts assignees', () => {
    const { result } = setup({
      tasks: [
        task({ _id: 't1', assignedToUser: { _id: 'u1', name: 'Zoe' } }),
        task({ _id: 't2', assignedToUser: { _id: 'u2', name: 'Alice', avatarUrl: 'a.png' } }),
        task({ _id: 't3', assignedToUser: { _id: 'u1', name: 'Zoe' } }),
      ],
    });

    expect(result.current.cellUsers).toEqual([
      { _id: 'u2', name: 'Alice', avatarUrl: 'a.png' },
      { _id: 'u1', name: 'Zoe', avatarUrl: undefined },
    ]);
  });

  it('falls back to "?" for an unnamed assignee', () => {
    const { result } = setup({
      tasks: [task({ assignedToUser: { _id: 'u1', name: '' } })],
    });
    expect(result.current.cellUsers).toEqual([{ _id: 'u1', name: '?', avatarUrl: undefined }]);
  });

  it('skips assignees without an id and missing assignees', () => {
    const { result } = setup({
      tasks: [task({ assignedToUser: { name: 'ghost' } }), task({ assignedToUser: null })],
    });
    expect(result.current.cellUsers).toEqual([]);
  });
});

describe('useTaskGrid - filter projects', () => {
  it('collects unique named projects and sorts them', () => {
    const { result } = setup({
      tasks: [
        task({ _id: 't1', projectId: 'p2', projectName: 'Beta' }),
        task({ _id: 't2', projectId: 'p1', projectName: 'Alpha' }),
        task({ _id: 't3', projectId: 'p2', projectName: 'Beta' }),
      ],
    });

    expect(result.current.filterProjects).toEqual([
      { _id: 'p1', name: 'Alpha' },
      { _id: 'p2', name: 'Beta' },
    ]);
  });

  it('ignores projects missing an id or name', () => {
    const { result } = setup({
      tasks: [task({ projectId: 'p1' }), task({ projectName: 'No id' })],
    });
    expect(result.current.filterProjects).toEqual([]);
  });

  it('resolves a project name by id', () => {
    const { result } = setup({
      tasks: [task({ projectId: 'p1', projectName: 'Alpha' })],
    });
    expect(result.current.projectNameOf('p1')).toBe('Alpha');
    expect(result.current.projectNameOf('nope')).toBeUndefined();
  });
});

describe('useTaskGrid - handleSetStatus', () => {
  it('updates a regular task and offers undo', async () => {
    const { result } = setup({ tasks: [task({ _id: 't1', status: 'pending' })] });

    await act(async () => {
      result.current.handleSetStatus('t1', 'completed');
    });
    await flush();

    expect(mut(api.tasks.setTaskStatus)).toHaveBeenCalledWith({
      taskId: 't1',
      statusKey: 'completed',
    });

    const toastCall = toastMock.mock.calls.find(
      (c) => c[1] && typeof c[1] === 'object' && c[1].action,
    );
    expect(toastCall).toBeDefined();

    await act(async () => {
      toastCall![1].action.onClick();
    });
    await flush();

    expect(mut(api.tasks.setTaskStatus)).toHaveBeenLastCalledWith({
      taskId: 't1',
      statusKey: 'pending',
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('routes recurring series to the recurring mutation', async () => {
    const { result } = setup({
      tasks: [task({ _id: 'r1', _type: 'recurring', status: 'pending' })],
    });

    await act(async () => {
      result.current.handleSetStatus('r1', 'in_progress');
    });
    await flush();

    expect(mut(api.recurringTasks.updateRecurringTaskStatus)).toHaveBeenCalledWith({
      seriesId: 'r1',
      status: 'in_progress',
    });
    expect(mut(api.tasks.setTaskStatus)).not.toHaveBeenCalled();
  });

  it('does not offer undo when the status did not change', async () => {
    const { result } = setup({ tasks: [task({ _id: 't1', status: 'completed' })] });

    await act(async () => {
      result.current.handleSetStatus('t1', 'completed');
    });
    await flush();

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('surfaces a ConvexError data string', async () => {
    mut(api.tasks.setTaskStatus).mockRejectedValue({ data: 'Not allowed' });
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handleSetStatus('t1', 'completed');
    });
    await flush();

    expect(toastMock.error).toHaveBeenCalledWith('Not allowed');
  });

  it('surfaces a plain Error message', async () => {
    mut(api.tasks.setTaskStatus).mockRejectedValue(new Error('kaboom'));
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handleSetStatus('t1', 'completed');
    });
    await flush();

    expect(toastMock.error).toHaveBeenCalledWith('kaboom');
  });

  it('falls back to a generic message for unknown failures', async () => {
    mut(api.tasks.setTaskStatus).mockRejectedValue('nope');
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handleSetStatus('t1', 'completed');
    });
    await flush();

    expect(toastMock.error).toHaveBeenCalledWith('Something went wrong');
  });
});

describe('useTaskGrid - handlePatchTask', () => {
  it('patches a regular task through bulkUpdateTasks', async () => {
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handlePatchTask('t1', { priority: 'high', assignedTo: 'u2' });
    });
    await flush();

    expect(mut(api.tasks.bulkUpdateTasks)).toHaveBeenCalledWith({
      taskIds: ['t1'],
      patch: { priority: 'high', assignedTo: 'u2' },
    });
  });

  it('includes the deadline when supplied', async () => {
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handlePatchTask('t1', { deadline: '2026-01-01' });
    });
    await flush();

    expect(mut(api.tasks.bulkUpdateTasks)).toHaveBeenCalledWith({
      taskIds: ['t1'],
      patch: { deadline: '2026-01-01' },
    });
  });

  it('reports skipped rows', async () => {
    mut(api.tasks.bulkUpdateTasks).mockResolvedValue({ skipped: 2 });
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handlePatchTask('t1', { priority: 'low' });
    });
    await flush();

    expect(toastMock.error).toHaveBeenCalled();
  });

  it('updates a recurring series instead', async () => {
    const { result } = setup({ tasks: [task({ _id: 'r1', _type: 'recurring' })] });

    await act(async () => {
      result.current.handlePatchTask('r1', { priority: 'high', assignedTo: 'u2' });
    });
    await flush();

    expect(mut(api.recurringTasks.updateRecurringTask)).toHaveBeenCalledWith({
      seriesId: 'r1',
      priority: 'high',
      assignedTo: 'u2',
    });
    expect(mut(api.tasks.bulkUpdateTasks)).not.toHaveBeenCalled();
  });
});

describe('useTaskGrid - handleSetField', () => {
  it('writes a custom field value', async () => {
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handleSetField('t1', 'f1', 'value');
    });
    await flush();

    expect(mut(api.tasks.updateTaskFields)).toHaveBeenCalledWith({
      taskId: 't1',
      values: { f1: 'value' },
    });
  });

  it('skips recurring series silently', async () => {
    const { result } = setup({ tasks: [task({ _id: 'r1', _type: 'recurring' })] });

    await act(async () => {
      result.current.handleSetField('r1', 'f1', 'value');
    });
    await flush();

    expect(mut(api.tasks.updateTaskFields)).not.toHaveBeenCalled();
  });
});

describe('useTaskGrid - handleAddTask', () => {
  it('does nothing without an assignee', async () => {
    const { result } = setup({ scope: {} });

    await act(async () => {
      await result.current.handleAddTask('New', {});
    });
    await flush();

    expect(mut(api.tasks.createTask)).not.toHaveBeenCalled();
  });

  it('uses the scope viewer as the assignee', async () => {
    const { result } = setup({ scope: { viewerId: 'viewer-9' } });

    await act(async () => {
      await result.current.handleAddTask('New', {});
    });
    await flush();

    expect(mut(api.tasks.createTask)).toHaveBeenCalledWith({
      title: 'New',
      assignedTo: 'viewer-9',
      priority: 'medium',
    });
  });

  it('seeds status, fields and project after creation', async () => {
    const { result } = setup({ scope: { viewerId: 'v1', projectId: 'proj-scope' } });

    await act(async () => {
      await result.current.handleAddTask('New', {
        assignedTo: 'u1',
        priority: 'high',
        statusKey: 'completed',
        projectId: 'proj-seed',
        fieldValues: { f1: 'x' },
      });
    });
    await flush();

    expect(mut(api.tasks.createTask)).toHaveBeenCalledWith({
      title: 'New',
      assignedTo: 'u1',
      priority: 'high',
      projectId: 'proj-seed',
    });
    expect(mut(api.tasks.setTaskStatus)).toHaveBeenCalledWith({
      taskId: 'new-task',
      statusKey: 'completed',
    });
    expect(mut(api.tasks.updateTaskFields)).toHaveBeenCalledWith({
      taskId: 'new-task',
      values: { f1: 'x' },
    });
  });

  it('falls back to the scope project when the seed has none', async () => {
    const { result } = setup({ scope: { viewerId: 'v1', projectId: 'proj-scope' } });

    await act(async () => {
      await result.current.handleAddTask('New', {});
    });
    await flush();

    expect(mut(api.tasks.createTask)).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-scope' }),
    );
  });
});

describe('useTaskGrid - bulk operations', () => {
  it('partitions regular and recurring tasks for patching', async () => {
    const { result } = setup({
      tasks: [task({ _id: 't1' }), task({ _id: 'r1', _type: 'recurring' })],
    });

    await act(async () => {
      result.current.handleBulkPatch(['t1', 'r1'], {
        statusKey: 'completed',
        priority: 'high',
        assignedTo: 'u2',
      });
    });
    await flush();

    expect(mut(api.tasks.bulkUpdateTasks)).toHaveBeenCalledWith({
      taskIds: ['t1'],
      patch: { statusKey: 'completed', priority: 'high', assignedTo: 'u2' },
    });
    expect(mut(api.recurringTasks.updateRecurringTaskStatus)).toHaveBeenCalledWith({
      seriesId: 'r1',
      status: 'completed',
    });
    expect(mut(api.recurringTasks.updateRecurringTask)).toHaveBeenCalledWith({
      seriesId: 'r1',
      priority: 'high',
      assignedTo: 'u2',
    });
  });

  it('passes only a status to a recurring series when that is all there is', async () => {
    const { result } = setup({ tasks: [task({ _id: 'r1', _type: 'recurring' })] });

    await act(async () => {
      result.current.handleBulkPatch(['r1'], { statusKey: 'cancelled' });
    });
    await flush();

    expect(mut(api.recurringTasks.updateRecurringTaskStatus)).toHaveBeenCalledWith({
      seriesId: 'r1',
      status: 'cancelled',
    });
    expect(mut(api.recurringTasks.updateRecurringTask)).not.toHaveBeenCalled();
  });

  it('deletes regular and recurring tasks through the right mutations', async () => {
    const { result } = setup({
      tasks: [task({ _id: 't1' }), task({ _id: 'r1', _type: 'recurring' })],
    });

    await act(async () => {
      result.current.handleBulkDelete(['t1', 'r1']);
    });
    await flush();

    expect(mut(api.tasks.bulkDeleteTasks)).toHaveBeenCalledWith({ taskIds: ['t1'] });
    expect(mut(api.recurringTasks.deleteRecurringTask)).toHaveBeenCalledWith({ seriesId: 'r1' });
  });

  it('reports skipped rows on bulk delete', async () => {
    mut(api.tasks.bulkDeleteTasks).mockResolvedValue({ skipped: 1 });
    const { result } = setup({ tasks: [task({ _id: 't1' })] });

    await act(async () => {
      result.current.handleBulkDelete(['t1']);
    });
    await flush();

    expect(toastMock.error).toHaveBeenCalled();
  });
});

describe('useTaskGrid - fields and views', () => {
  it('creates a field scoped to the grid', async () => {
    const { result } = setup({
      scope: { viewerId: 'v1', organizationId: 'org1', projectId: 'proj1' },
    });

    await act(async () => {
      result.current.handleCreateField({
        name: 'Confidence',
        type: 'number',
        options: ['low', 'high'],
        config: { precision: 1 },
        required: true,
      });
    });
    await flush();

    expect(mut(api.taskFields.createField)).toHaveBeenCalledWith({
      name: 'Confidence',
      type: 'number',
      options: ['low', 'high'],
      config: { precision: 1 },
      required: true,
      organizationId: 'org1',
      projectId: 'proj1',
    });
  });

  it('creates a view and returns its id', async () => {
    const { result } = setup({ scope: { viewerId: 'v1', organizationId: 'org1' } });

    let created: string | undefined;
    await act(async () => {
      created = await result.current.createView({
        name: 'My view',
        type: 'table',
        state: {} as never,
        visibility: 'private',
      });
    });

    expect(created).toBe('new-view');
    expect(mut(api.taskViews.saveView)).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My view', organizationId: 'org1' }),
    );
  });

  it('updates, renames, removes and defaults views', async () => {
    const { result } = setup();

    await act(async () => {
      result.current.updateViewState('v1', 'board', {} as never);
    });
    await flush();
    expect(mut(api.taskViews.updateView)).toHaveBeenCalledWith({
      viewId: 'v1',
      type: 'board',
      state: {},
    });

    await act(async () => {
      result.current.renameView('v1', 'Renamed');
    });
    await flush();
    expect(mut(api.taskViews.updateView)).toHaveBeenLastCalledWith({
      viewId: 'v1',
      name: 'Renamed',
    });

    await act(async () => {
      await result.current.removeView('v1');
    });
    expect(mut(api.taskViews.deleteView)).toHaveBeenCalledWith({ viewId: 'v1' });

    await act(async () => {
      result.current.setDefaultView('v1');
    });
    await flush();
    expect(mut(api.taskViews.setDefaultView)).toHaveBeenCalledWith({ viewId: 'v1' });
  });
});
