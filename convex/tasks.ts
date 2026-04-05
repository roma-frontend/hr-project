import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

/**
 * Helper to batch load users and enrich task data
 * Eliminates N+1 queries for task lists
 */
async function enrichTasksWithUserData(ctx: any, tasks: any[]) {
  if (tasks.length === 0) return [];

  // Collect all unique user IDs
  const assignedToIds = [...new Set(tasks.map((t) => t.assignedTo))];
  const assignedByIds = [...new Set(tasks.map((t) => t.assignedBy))];
  const allUserIds = [...new Set([...assignedToIds, ...assignedByIds])];

  // Batch load all users
  const users = await Promise.all(allUserIds.map((id: Id<'users'>) => ctx.db.get(id)));
  const userMap = new Map(users.map((u) => [u?._id, u]));

  // Batch load all comments
  const allComments = await ctx.db.query('taskComments').collect();
  const commentsByTask = new Map<Id<'tasks'>, any[]>();
  tasks.forEach((t) => {
    commentsByTask.set(
      t._id,
      allComments.filter((c: any) => c.taskId === t._id),
    );
  });

  // Collect all comment author IDs
  const commentAuthorIds = [...new Set(allComments.map((c: any) => c.authorId))];
  const commentAuthors = await Promise.all(
    commentAuthorIds.map((id: any) => ctx.db.get(id as Id<'users'>)),
  );
  const commentAuthorMap = new Map(commentAuthors.map((a: any) => [a?._id, a]));

  // Enrich tasks
  return tasks.map((task) => {
    const assignedTo = userMap.get(task.assignedTo);
    const assignedBy = userMap.get(task.assignedBy);
    const taskComments = commentsByTask.get(task._id) || [];

    return {
      ...task,
      assignedToUser: assignedTo
        ? {
            ...assignedTo,
            avatarUrl: assignedTo.avatarUrl ?? assignedTo.faceImageUrl,
          }
        : null,
      assignedByUser: assignedBy
        ? {
            ...assignedBy,
            avatarUrl: assignedBy.avatarUrl ?? assignedBy.faceImageUrl,
          }
        : null,
      comments: taskComments.map((c) => ({
        ...c,
        author: commentAuthorMap.get(c.authorId),
      })),
      commentCount: taskComments.length,
    };
  });
}

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

// ── Create Task ────────────────────────────────────────────────────────────
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.id('users'),
    assignedBy: v.id('users'),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('urgent'),
    ),
    deadline: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const assigner = await ctx.db.get(args.assignedBy);
    const organizationId = assigner?.organizationId;

    const now = Date.now();
    const taskId = await ctx.db.insert('tasks', {
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      assignedBy: args.assignedBy,
      organizationId,
      status: 'pending',
      priority: args.priority,
      deadline: args.deadline,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the person who assigned the task (skip superadmin)
    if (assigner?.role !== 'superadmin') {
      await ctx.db.insert('notifications', {
        userId: args.assignedBy,
        type: 'system',
        title: 'Task Assigned',
        message: `You assigned a task: "${args.title}"`,
        isRead: false,
        relatedId: taskId,
        createdAt: now,
      });
    }

    return taskId;
  },
});

// ── Update Task Status (employee can update) ───────────────────────────────
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id('tasks'),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('review'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: args.status,
      updatedAt: now,
      completedAt: args.status === 'completed' ? now : task.completedAt,
    });

    // Notify supervisor when task goes to review or completed (skip superadmin)
    if (args.status === 'review' || args.status === 'completed') {
      const employee = await ctx.db.get(args.userId);
      const supervisor = await ctx.db.get(task.assignedBy);
      if (supervisor?.role !== 'superadmin') {
        await ctx.db.insert('notifications', {
          userId: task.assignedBy,
          type: 'system',
          title: args.status === 'completed' ? 'Task Completed' : 'Task Ready for Review',
          message: `"${task.title}" has been ${args.status === 'completed' ? 'completed' : 'submitted for review'} by ${employee?.name ?? 'employee'}`,
          isRead: false,
          relatedId: args.taskId,
          createdAt: now,
        });
      }
    }
  },
});

// ── Update Task (supervisor/admin) ─────────────────────────────────────────
export const updateTask = mutation({
  args: {
    taskId: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('urgent')),
    ),
    deadline: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('review'),
        v.literal('completed'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    await ctx.db.patch(taskId, { ...filtered, updatedAt: Date.now() });
  },
});

// ── Delete Task ────────────────────────────────────────────────────────────
export const deleteTask = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    // Delete comments first
    const comments = await ctx.db
      .query('taskComments')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    await ctx.db.delete(args.taskId);
  },
});

// ── Add Comment ────────────────────────────────────────────────────────────
export const addComment = mutation({
  args: {
    taskId: v.id('tasks'),
    authorId: v.id('users'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('taskComments', {
      taskId: args.taskId,
      authorId: args.authorId,
      content: args.content,
      createdAt: now,
    });
    await ctx.db.patch(args.taskId, { updatedAt: now });
  },
});

// ── Assign Supervisor to Employee ──────────────────────────────────────────
export const assignSupervisor = mutation({
  args: {
    employeeId: v.id('users'),
    supervisorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.employeeId, {
      supervisorId: args.supervisorId,
    });
  },
});

// ── Get Tasks for Employee ─────────────────────────────────────────────────
// OPTIMIZED: Batch loading eliminates N+1 queries
export const getTasksForEmployee = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.userId);
    if (!employee) throw new Error('Employee not found');

    const isSuperadmin = employee.email.toLowerCase() === SUPERADMIN_EMAIL;

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_to', (q) => q.eq('assignedTo', args.userId))
      .order('desc')
      .collect();

    // Filter by organization (skip for superadmin)
    let orgTasks = tasks;
    if (!isSuperadmin) {
      orgTasks = tasks.filter(
        (task) => !employee.organizationId || task.organizationId === employee.organizationId,
      );
    }

    return enrichTasksWithUserData(ctx, orgTasks);
  },
});

// ── Get Tasks assigned by supervisor ──────────────────────────────────────
// OPTIMIZED: Batch loading eliminates N+1 queries
export const getTasksAssignedBy = query({
  args: { supervisorId: v.id('users') },
  handler: async (ctx, args) => {
    const supervisor = await ctx.db.get(args.supervisorId);
    if (!supervisor) throw new Error('Supervisor not found');

    const isSuperadmin = supervisor.email.toLowerCase() === SUPERADMIN_EMAIL;

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_assigned_by', (q) => q.eq('assignedBy', args.supervisorId))
      .order('desc')
      .collect();

    // Filter by organization (skip for superadmin)
    let orgTasks = tasks;
    if (!isSuperadmin) {
      orgTasks = tasks.filter(
        (task) => !supervisor.organizationId || task.organizationId === supervisor.organizationId,
      );
    }

    return enrichTasksWithUserData(ctx, orgTasks);
  },
});

// ── Get All Tasks (admin) ──────────────────────────────────────────────────
// OPTIMIZED: Batch loading eliminates N+1 queries
export const getAllTasks = query({
  args: { requesterId: v.id('users'), selectedOrganizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, args) => {
    const requester = await ctx.db.get(args.requesterId);
    if (!requester) throw new Error('Requester not found');

    // Only admin/superadmin can get all tasks
    if (requester.role !== 'admin' && requester.role !== 'superadmin') {
      throw new Error('Only admins can access all tasks');
    }

    const isSuperadmin = requester.email.toLowerCase() === SUPERADMIN_EMAIL;

    // Superadmin without org can still access (but will see nothing if no tasks exist)
    if (!isSuperadmin && !requester.organizationId) {
      throw new Error('Admin must belong to an organization');
    }

    const tasks = await ctx.db.query('tasks').order('desc').collect();

    // Filter tasks by organization
    let orgTasks = tasks;
    if (isSuperadmin) {
      // For superadmin: filter by selectedOrganizationId if provided
      if (args.selectedOrganizationId) {
        orgTasks = tasks.filter((task) => task.organizationId === args.selectedOrganizationId);
      }
      // If no selectedOrganizationId, superadmin sees all tasks (no filter)
    } else {
      // For regular admin: filter by their organization
      orgTasks = tasks.filter((task) => task.organizationId === requester.organizationId);
    }

    return enrichTasksWithUserData(ctx, orgTasks);
  },
});

// ── Get My Team Tasks (supervisor sees tasks of their subordinates) ─────────
// OPTIMIZED: Batch loading eliminates N+1 queries
export const getTeamTasks = query({
  args: { supervisorId: v.id('users') },
  handler: async (ctx, args) => {
    // Get all employees under this supervisor
    const employees = await ctx.db
      .query('users')
      .withIndex('by_supervisor', (q) => q.eq('supervisorId', args.supervisorId))
      .collect();

    const employeeIds = employees.map((e) => e._id);

    // Get all tasks and filter by employee IDs
    const allTasks = await ctx.db.query('tasks').collect();
    const teamTasks = allTasks.filter((t) => employeeIds.includes(t.assignedTo));

    return enrichTasksWithUserData(ctx, teamTasks);
  },
});

// ── Get Employees under supervisor ────────────────────────────────────────
export const getMyEmployees = query({
  args: { supervisorId: v.id('users') },
  handler: async (ctx, args) => {
    const employees = await ctx.db
      .query('users')
      .withIndex('by_supervisor', (q) => q.eq('supervisorId', args.supervisorId))
      .collect();
    return employees.map((e) => ({
      ...e,
      avatarUrl: e.avatarUrl ?? e.faceImageUrl,
    }));
  },
});

// ── Get all users for assignment (admin/supervisor) ────────────────────────
export const getUsersForAssignment = query({
  args: { requesterId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    // If requesterId provided, filter by organization
    let users = await ctx.db.query('users').collect();

    if (args.requesterId) {
      const requester = await ctx.db.get(args.requesterId);
      if (requester && requester.organizationId) {
        users = users.filter((u) => u.organizationId === requester.organizationId);
      }
    }

    // Return all active users (employees, supervisors, admins, AND drivers)
    // Anyone in the organization can be assigned a task
    return users
      .filter(
        (u) =>
          u.isActive !== false &&
          u.isApproved !== false &&
          (u.role === 'employee' ||
            u.role === 'supervisor' ||
            u.role === 'admin' ||
            u.role === 'driver'),
      )
      .map((u) => ({
        _id: u._id,
        name: u.name,
        position: u.position,
        department: u.department,
        avatarUrl: u.avatarUrl ?? u.faceImageUrl,
        supervisorId: u.supervisorId,
        role: u.role,
      }));
  },
});

// ── Get supervisors list ───────────────────────────────────────────────────
export const getSupervisors = query({
  args: { requesterId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    console.log('[getSupervisors] args:', args);

    let supervisors = await ctx.db
      .query('users')
      .withIndex('by_role', (q) => q.eq('role', 'supervisor'))
      .collect();
    let admins = await ctx.db
      .query('users')
      .withIndex('by_role', (q) => q.eq('role', 'admin'))
      .collect();

    console.log('[getSupervisors] raw supervisors:', supervisors.length, 'admins:', admins.length);

    // Filter by organization if requesterId provided
    if (args.requesterId) {
      const requester = await ctx.db.get(args.requesterId);
      console.log('[getSupervisors] requester:', requester);
      if (requester && requester.organizationId) {
        supervisors = supervisors.filter((u) => u.organizationId === requester.organizationId);
        admins = admins.filter((u) => u.organizationId === requester.organizationId);
      }
    }

    console.log(
      '[getSupervisors] filtered supervisors:',
      supervisors.length,
      'admins:',
      admins.length,
    );

    return [...supervisors, ...admins]
      .filter((u) => u.isActive && u.isApproved)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        role: u.role,
        position: u.position,
        department: u.department,
        avatarUrl: u.avatarUrl ?? u.faceImageUrl,
      }));
  },
});

// ── Get task comments ──────────────────────────────────────────────────────
// ── Add Attachment ─────────────────────────────────────────────────────────
export const addAttachment = mutation({
  args: {
    taskId: v.id('tasks'),
    url: v.string(),
    name: v.string(),
    type: v.string(),
    size: v.number(),
    uploadedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');
    const attachments = task.attachments ?? [];
    await ctx.db.patch(args.taskId, {
      attachments: [
        ...attachments,
        {
          url: args.url,
          name: args.name,
          type: args.type,
          size: args.size,
          uploadedBy: args.uploadedBy,
          uploadedAt: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    });
  },
});

// ── Remove Attachment ──────────────────────────────────────────────────────
export const removeAttachment = mutation({
  args: {
    taskId: v.id('tasks'),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');
    const attachments = (task.attachments ?? []).filter((a: any) => a.url !== args.url);
    await ctx.db.patch(args.taskId, { attachments, updatedAt: Date.now() });
  },
});

// ── Get Task Comments ──────────────────────────────────────────────────────
// OPTIMIZED: Batch loading for comments with authors
export const getTaskComments = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('taskComments')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .order('asc')
      .collect();

    // Batch load all authors
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = await Promise.all(authorIds.map((id: Id<'users'>) => ctx.db.get(id)));
    const authorMap = new Map(authors.map((a) => [a?._id, a]));

    return comments.map((c) => ({
      ...c,
      author: authorMap.get(c.authorId),
    }));
  },
});
