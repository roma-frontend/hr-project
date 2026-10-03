import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { query, mutation, type QueryCtx, type MutationCtx } from './_generated/server';
import type { Id, Doc } from './_generated/dataModel';
import { MAX_PAGE_SIZE } from './pagination';
import { isSuperadmin } from './lib/auth';
import { DEFAULT_LIST_CAP, SMALL_LIST_CAP } from './lib/limits';
import { getAuthCaller } from './lib/getAuthCaller';
import { assertModuleAccess } from './lib/entitlements';

// ─── Helper: Check permissions ───────────────────────────────────────────────
// Identity is derived from the verified JWT (getAuthCaller), never from client args.
async function checkAccess(ctx: QueryCtx | MutationCtx, organizationId: Id<'organizations'>) {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');
  const requester = await ctx.db.get(caller._id);
  if (!requester) throw new Error('Requester not found');
  const userIsSuperadmin = isSuperadmin(requester);
  if (!userIsSuperadmin && requester.organizationId !== organizationId) {
    throw new Error('Access denied');
  }
  return {
    requester,
    requesterId: caller._id,
    isSuperadmin: userIsSuperadmin || requester.role === 'admin',
  };
}

// Shared read policy also covers legacy detail/history and lesson-linked quiz paths.
async function requireReadableCourse(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  courseId: Id<'courses'>,
  isAdmin: boolean,
) {
  const course = await ctx.db.get(courseId);
  if (!course || course.organizationId !== organizationId || (!isAdmin && !course.isPublished)) {
    throw new Error('Course not found');
  }
  return course;
}

async function assertReadableQuiz(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  quiz: Doc<'quizzes'>,
  isAdmin: boolean,
) {
  if (quiz.organizationId !== organizationId || (!isAdmin && !quiz.isPublished)) {
    throw new Error('Quiz not found');
  }
  if (quiz.courseId) {
    await requireReadableCourse(ctx, organizationId, quiz.courseId, isAdmin);
  }
  if (quiz.lessonId) {
    const lesson = await ctx.db.get(quiz.lessonId);
    if (
      !lesson ||
      lesson.organizationId !== organizationId ||
      (quiz.courseId && lesson.courseId !== quiz.courseId)
    ) {
      throw new Error('Lesson not found');
    }
    await requireReadableCourse(ctx, organizationId, lesson.courseId, isAdmin);
  }
}

function readableQuestion(question: Doc<'quizQuestions'>, isAdmin: boolean) {
  const { correctAnswer, explanation, ...safe } = question;
  return { ...safe, ...(isAdmin ? { correctAnswer, explanation } : {}) };
}

// Completion evidence is shared by progress, status and manual certificate paths.
async function courseCompletion(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  courseId: Id<'courses'>,
  userId: Id<'users'>,
) {
  const course = await ctx.db.get(courseId);
  if (!course || course.organizationId !== organizationId || !course.isPublished) {
    throw new Error('Course not found');
  }
  const enrollment = await ctx.db
    .query('enrollments')
    .withIndex('by_user_course', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId).eq('courseId', courseId),
    )
    .first();
  if (
    !enrollment ||
    enrollment.status === 'expired' ||
    (enrollment.expiresAt !== undefined && enrollment.expiresAt <= Date.now())
  ) {
    throw new Error('Active enrollment required');
  }
  const lessons = await ctx.db
    .query('lessons')
    .withIndex('by_course', (q) => q.eq('organizationId', organizationId).eq('courseId', courseId))
    .take(DEFAULT_LIST_CAP + 1);
  const progress = await ctx.db
    .query('lessonProgress')
    .withIndex('by_user_course', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId).eq('courseId', courseId),
    )
    .take(DEFAULT_LIST_CAP + 1);
  if (lessons.length > DEFAULT_LIST_CAP || progress.length > DEFAULT_LIST_CAP) {
    throw new Error('Course exceeds completion limit');
  }
  const quizzes = await ctx.db
    .query('quizzes')
    .withIndex('by_course', (q) => q.eq('organizationId', organizationId).eq('courseId', courseId))
    .take(DEFAULT_LIST_CAP + 1);
  if (quizzes.length > DEFAULT_LIST_CAP) throw new Error('Course exceeds completion limit');
  const byId = new Map(quizzes.map((quiz) => [quiz._id, quiz]));
  const quizLessons = new Set<Id<'lessons'>>();
  for (const lesson of lessons) {
    const linked = await ctx.db
      .query('quizzes')
      .withIndex('by_lesson', (q) =>
        q.eq('organizationId', organizationId).eq('lessonId', lesson._id),
      )
      .take(DEFAULT_LIST_CAP + 1);
    if (linked.length) quizLessons.add(lesson._id);
    for (const quiz of linked) byId.set(quiz._id, quiz);
    if (byId.size > DEFAULT_LIST_CAP) throw new Error('Course exceeds completion limit');
  }
  const completed = new Set(progress.filter((row) => row.isCompleted).map((row) => row.lessonId));
  const lessonIds = new Set(lessons.map((lesson) => lesson._id));
  let quizzesPassed = true;
  for (const quiz of byId.values()) {
    if (
      !quiz.isPublished ||
      (quiz.courseId && quiz.courseId !== courseId) ||
      (quiz.lessonId && !lessonIds.has(quiz.lessonId))
    ) {
      quizzesPassed = false;
      continue;
    }
    const passed = await ctx.db
      .query('quizAttempts')
      .withIndex('by_user_quiz', (q) =>
        q.eq('organizationId', organizationId).eq('userId', userId).eq('quizId', quiz._id),
      )
      .filter((q) => q.eq(q.field('passed'), true))
      .first();
    if (!passed) quizzesPassed = false;
  }
  const completedCount = lessons.filter((lesson) => completed.has(lesson._id)).length;
  const complete =
    lessons.length > 0 &&
    completedCount === lessons.length &&
    quizzesPassed &&
    lessons.every((lesson) => lesson.contentType !== 'quiz' || quizLessons.has(lesson._id));
  // Never round an unfinished course up to 100%.
  const percent = complete
    ? 100
    : lessons.length
      ? Math.min(99, Math.floor((completedCount / lessons.length) * 100))
      : 0;
  return { enrollment, complete, progress: percent };
}

// ─── COURSES ─────────────────────────────────────────────────────────────────

export const listCourses = query({
  args: {
    organizationId: v.id('organizations'),
    category: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    search: v.optional(v.string()),
    includeUnpublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);

    const rawCourses = await ctx.db
      .query('courses')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(MAX_PAGE_SIZE + 1);
    const coursesIsCapped = rawCourses.length > MAX_PAGE_SIZE;
    let courses = rawCourses.slice(0, MAX_PAGE_SIZE);
    void coursesIsCapped;

    if (!args.includeUnpublished || !isSuperadmin) {
      courses = courses.filter((c) => c.isPublished);
    }

    if (args.category) courses = courses.filter((c) => c.category === args.category);
    if (args.difficulty) courses = courses.filter((c) => c.difficulty === args.difficulty);
    if (args.search) {
      const lower = args.search.toLowerCase();
      courses = courses.filter(
        (c) =>
          c.title.toLowerCase().includes(lower) || c.description?.toLowerCase().includes(lower),
      );
    }

    const enriched = await Promise.all(
      courses.map(async (course) => {
        const lessonRows = await ctx.db
          .query('lessons')
          .withIndex('by_course', (q) =>
            q.eq('organizationId', args.organizationId).eq('courseId', course._id),
          )
          .take(MAX_PAGE_SIZE + 1);
        const creator = await ctx.db.get(course.createdBy);
        return {
          ...course,
          creatorName: creator?.name ?? 'Unknown',
          lessonCount: Math.min(lessonRows.length, MAX_PAGE_SIZE),
          lessonCountIsCapped: lessonRows.length > MAX_PAGE_SIZE,
        };
      }),
    );

    // Legacy: keeps array return for backward compat (slice prevents silent truncation).
    // Per-row lessonCountIsCapped and coursesIsCapped (internal) make caps visible; prefer paginated variant.
    return enriched;
  },
});

/** Native cursor catalog. Legacy listCourses remains available for older clients. */
export const listCoursesPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    search: v.optional(v.string()),
    includeUnpublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const courses = ctx.db.query('courses');
    let scoped =
      args.includeUnpublished && isSuperadmin
        ? courses.withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
        : courses.withIndex('by_org_published', (q) =>
            q.eq('organizationId', args.organizationId).eq('isPublished', true),
          );
    if (args.category) {
      scoped = scoped.filter((q) => q.eq(q.field('category'), args.category));
    }
    if (args.difficulty) {
      scoped = scoped.filter((q) => q.eq(q.field('difficulty'), args.difficulty));
    }
    const result = await scoped.paginate({
      ...args.paginationOpts,
      numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
    });
    const search = args.search?.trim().toLowerCase();
    const page = search
      ? result.page.filter(
          (course) =>
            course.title.toLowerCase().includes(search) ||
            course.description?.toLowerCase().includes(search),
        )
      : result.page;
    const enriched = await Promise.all(
      page.map(async (course) => {
        const lessons = await ctx.db
          .query('lessons')
          .withIndex('by_course', (q) =>
            q.eq('organizationId', args.organizationId).eq('courseId', course._id),
          )
          .take(MAX_PAGE_SIZE + 1);
        const creator = await ctx.db.get(course.createdBy);
        const enrollment = await ctx.db
          .query('enrollments')
          .withIndex('by_user_course', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('userId', requesterId)
              .eq('courseId', course._id),
          )
          .first();
        return {
          ...course,
          myEnrollment: enrollment
            ? { status: enrollment.status, progress: enrollment.progress ?? 0 }
            : null,
          creatorName: creator?.organizationId === args.organizationId ? creator.name : 'Unknown',
          lessonCount: Math.min(lessons.length, MAX_PAGE_SIZE),
          lessonCountIsCapped: lessons.length > MAX_PAGE_SIZE,
        };
      }),
    );
    return { ...result, page: enriched };
  },
});

export const getCourse = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const course = await requireReadableCourse(
      ctx,
      args.organizationId,
      args.courseId,
      isSuperadmin,
    );
    return course;
  },
});

export const getCourseWithLessons = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const course = await requireReadableCourse(
      ctx,
      args.organizationId,
      args.courseId,
      isSuperadmin,
    );
    const myEnrollment = await ctx.db
      .query('enrollments')
      .withIndex('by_user_course', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('courseId', course._id),
      )
      .first();
    const lessonRows = await ctx.db
      .query('lessons')
      .withIndex('by_course', (q) =>
        q.eq('organizationId', args.organizationId).eq('courseId', course._id),
      )
      .order('asc')
      .take(DEFAULT_LIST_CAP + 1);
    const lessonsIsCapped = lessonRows.length > DEFAULT_LIST_CAP;
    const lessons = lessonRows.slice(0, DEFAULT_LIST_CAP);

    return {
      course,
      lessons,
      lessonsIsCapped,
      myEnrollment: myEnrollment
        ? { status: myEnrollment.status, progress: myEnrollment.progress ?? 0 }
        : null,
    };
  },
});

/** Paginated lessons for a course. Legacy getCourseWithLessons remains for short courses. */
export const getCourseLessonsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    await requireReadableCourse(ctx, args.organizationId, args.courseId, isSuperadmin);
    const result = await ctx.db
      .query('lessons')
      .withIndex('by_course', (q) =>
        q.eq('organizationId', args.organizationId).eq('courseId', args.courseId),
      )
      .order('asc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    return result;
  },
});

/** Paginated quizzes for a course. */
export const getCourseQuizzesPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    await requireReadableCourse(ctx, args.organizationId, args.courseId, isSuperadmin);
    const scoped = ctx.db
      .query('quizzes')
      .withIndex('by_course', (q) =>
        q.eq('organizationId', args.organizationId).eq('courseId', args.courseId),
      );
    const published = isSuperadmin
      ? scoped
      : scoped.filter((q) => q.eq(q.field('isPublished'), true));
    const result = await published.paginate({
      ...args.paginationOpts,
      numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
    });
    return result;
  },
});

export const createCourse = mutation({
  args: {
    organizationId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    difficulty: v.union(v.literal('beginner'), v.literal('intermediate'), v.literal('advanced')),
    estimatedHours: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    isMandatory: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can create courses');

    const now = Date.now();
    return await ctx.db.insert('courses', {
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      category: args.category,
      difficulty: args.difficulty,
      estimatedHours: args.estimatedHours,
      thumbnailUrl: args.thumbnailUrl,
      createdBy: requesterId,
      isPublished: false,
      isMandatory: args.isMandatory ?? false,
      tags: args.tags ?? [],
      contentVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCourse = mutation({
  args: {
    courseId: v.id('courses'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal('beginner'), v.literal('intermediate'), v.literal('advanced')),
    ),
    estimatedHours: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isMandatory: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error('Course not found');
    const { isSuperadmin } = await checkAccess(ctx, course.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can update courses');

    const patch: Partial<Doc<'courses'>> = { updatedAt: Date.now() };
    const bumpsVersion =
      args.title !== undefined ||
      args.description !== undefined ||
      args.category !== undefined ||
      args.difficulty !== undefined ||
      args.estimatedHours !== undefined ||
      args.thumbnailUrl !== undefined ||
      args.tags !== undefined;
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.category !== undefined) patch.category = args.category;
    if (args.difficulty !== undefined) patch.difficulty = args.difficulty;
    if (args.estimatedHours !== undefined) patch.estimatedHours = args.estimatedHours;
    if (args.thumbnailUrl !== undefined) patch.thumbnailUrl = args.thumbnailUrl;
    if (args.isPublished !== undefined) patch.isPublished = args.isPublished;
    if (args.isMandatory !== undefined) patch.isMandatory = args.isMandatory;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (bumpsVersion) patch.contentVersion = (course.contentVersion ?? 1) + 1;
    else if (course.contentVersion === undefined) patch.contentVersion = 1;

    await ctx.db.patch(args.courseId, patch);
    return { success: true };
  },
});

export const deleteCourse = mutation({
  args: {
    courseId: v.id('courses'),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error('Course not found');
    const { isSuperadmin } = await checkAccess(ctx, course.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can delete courses');

    while (true) {
      const batch = await ctx.db
        .query('lessons')
        .withIndex('by_course', (q) =>
          q.eq('organizationId', course.organizationId).eq('courseId', course._id),
        )
        .take(SMALL_LIST_CAP);
      if (batch.length === 0) break;
      for (const lesson of batch) await ctx.db.delete(lesson._id);
      if (batch.length < SMALL_LIST_CAP) break;
    }

    while (true) {
      const batch = await ctx.db
        .query('enrollments')
        .withIndex('by_course', (q) =>
          q.eq('organizationId', course.organizationId).eq('courseId', course._id),
        )
        .take(DEFAULT_LIST_CAP);
      if (batch.length === 0) break;
      for (const enrollment of batch) await ctx.db.delete(enrollment._id);
      if (batch.length < DEFAULT_LIST_CAP) break;
    }

    await ctx.db.delete(args.courseId);
    return { success: true };
  },
});

// ─── LESSONS ─────────────────────────────────────────────────────────────────

export const createLesson = mutation({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    contentType: v.union(
      v.literal('video'),
      v.literal('text'),
      v.literal('quiz'),
      v.literal('mixed'),
    ),
    videoUrl: v.optional(v.string()),
    textContent: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    isPreview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can create lessons');
    const course = await ctx.db.get(args.courseId);
    if (!course || course.organizationId !== args.organizationId) {
      throw new Error('Course not found');
    }

    const now = Date.now();
    return await ctx.db.insert('lessons', {
      organizationId: args.organizationId,
      courseId: args.courseId,
      title: args.title,
      description: args.description,
      order: args.order,
      contentType: args.contentType,
      videoUrl: args.videoUrl,
      textContent: args.textContent,
      durationMinutes: args.durationMinutes,
      isPreview: args.isPreview ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateLesson = mutation({
  args: {
    lessonId: v.id('lessons'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
    contentType: v.optional(
      v.union(v.literal('video'), v.literal('text'), v.literal('quiz'), v.literal('mixed')),
    ),
    videoUrl: v.optional(v.string()),
    textContent: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    isPreview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error('Lesson not found');
    const { isSuperadmin } = await checkAccess(ctx, lesson.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can update lessons');

    const patch: Partial<Doc<'lessons'>> = { updatedAt: Date.now() };
    const bumpsCourse =
      args.title !== undefined ||
      args.description !== undefined ||
      args.contentType !== undefined ||
      args.videoUrl !== undefined ||
      args.textContent !== undefined ||
      args.durationMinutes !== undefined;
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.order !== undefined) patch.order = args.order;
    if (args.contentType !== undefined) patch.contentType = args.contentType;
    if (args.videoUrl !== undefined) patch.videoUrl = args.videoUrl;
    if (args.textContent !== undefined) patch.textContent = args.textContent;
    if (args.durationMinutes !== undefined) patch.durationMinutes = args.durationMinutes;
    if (args.isPreview !== undefined) patch.isPreview = args.isPreview;

    await ctx.db.patch(args.lessonId, patch);
    if (bumpsCourse) {
      const course = await ctx.db.get(lesson.courseId);
      if (course)
        await ctx.db.patch(course._id, {
          contentVersion: (course.contentVersion ?? 1) + 1,
          updatedAt: Date.now(),
        });
    }
    return { success: true };
  },
});

export const deleteLesson = mutation({
  args: {
    lessonId: v.id('lessons'),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error('Lesson not found');
    const { isSuperadmin } = await checkAccess(ctx, lesson.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can delete lessons');

    while (true) {
      const batch = await ctx.db
        .query('lessonProgress')
        .withIndex('by_user_course', (q) => q.eq('organizationId', lesson.organizationId))
        .filter((q) => q.eq(q.field('lessonId'), lesson._id))
        .take(DEFAULT_LIST_CAP);
      if (batch.length === 0) break;
      for (const p of batch) await ctx.db.delete(p._id);
      if (batch.length < DEFAULT_LIST_CAP) break;
    }

    await ctx.db.delete(args.lessonId);
    return { success: true };
  },
});

// ─── ENROLLMENTS ─────────────────────────────────────────────────────────────

export const getMyEnrollments = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_user', (q) =>
        q.eq('organizationId', args.organizationId).eq('userId', requesterId),
      )
      .take(DEFAULT_LIST_CAP);

    const enriched = await Promise.all(
      enrollments.map(async (enrollment) => {
        const linkedCourse = await ctx.db.get(enrollment.courseId);
        const course =
          linkedCourse?.organizationId === args.organizationId &&
          (isSuperadmin || linkedCourse.isPublished)
            ? linkedCourse
            : null;
        return { ...enrollment, courseTitle: course?.title ?? 'Unknown Course', course };
      }),
    );

    return enriched;
  },
});

/** Personal course history without the legacy array cap. */
export const getMyEnrollmentsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const result = await ctx.db
      .query('enrollments')
      .withIndex('by_user', (q) =>
        q.eq('organizationId', args.organizationId).eq('userId', requesterId),
      )
      .order('desc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    const page = await Promise.all(
      result.page.map(async (enrollment) => {
        const linkedCourse = await ctx.db.get(enrollment.courseId);
        const course =
          linkedCourse?.organizationId === args.organizationId &&
          (isSuperadmin || linkedCourse.isPublished)
            ? linkedCourse
            : null;
        return { ...enrollment, courseTitle: course?.title ?? 'Unknown Course', course };
      }),
    );
    return { ...result, page };
  },
});

export const getCourseEnrollments = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view course enrollments');
    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_course', (q) =>
        q.eq('organizationId', args.organizationId).eq('courseId', args.courseId),
      )
      .take(DEFAULT_LIST_CAP);

    const enriched = await Promise.all(
      enrollments.map(async (enrollment) => {
        const user = await ctx.db.get(enrollment.userId);
        return { ...enrollment, userName: user?.name ?? 'Unknown', userEmail: user?.email };
      }),
    );

    return enriched;
  },
});

/** Cursor-based course enrollment list. Legacy getCourseEnrollments remains available. */
export const getCourseEnrollmentsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view course enrollments');
    const course = await ctx.db.get(args.courseId);
    if (!course || course.organizationId !== args.organizationId) {
      throw new Error('Course not found');
    }
    const result = await ctx.db
      .query('enrollments')
      .withIndex('by_course', (q) =>
        q.eq('organizationId', args.organizationId).eq('courseId', args.courseId),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    const page = await Promise.all(
      result.page.map(async (enrollment) => {
        const user = await ctx.db.get(enrollment.userId);
        return {
          ...enrollment,
          userName: user?.organizationId === args.organizationId ? user.name : 'Unknown',
          userEmail: user?.organizationId === args.organizationId ? user.email : '',
          userDepartment:
            user?.organizationId === args.organizationId ? user.department : undefined,
        };
      }),
    );
    return { ...result, page };
  },
});

export const enrollInCourse = mutation({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    enrolledBy: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const course = await ctx.db.get(args.courseId);
    if (
      !course ||
      course.organizationId !== args.organizationId ||
      (!isSuperadmin && !course.isPublished)
    ) {
      throw new Error('Course not found');
    }
    if (args.enrolledBy && args.enrolledBy !== requesterId) {
      throw new Error('Caller mismatch');
    }

    const existing = await ctx.db
      .query('enrollments')
      .withIndex('by_user_course', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('courseId', args.courseId),
      )
      .first();

    if (existing) {
      if (existing.status === 'completed') {
        return { success: false, message: 'Course already completed' };
      }
      return { success: false, message: 'Already enrolled' };
    }

    const now = Date.now();
    await ctx.db.insert('enrollments', {
      organizationId: args.organizationId,
      userId: requesterId,
      courseId: args.courseId,
      status: 'not_started',
      progress: 0,
      enrolledBy: args.enrolledBy,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const bulkEnrollUsers = mutation({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.id('courses'),
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can bulk enroll users');
    const course = await ctx.db.get(args.courseId);
    if (!course || course.organizationId !== args.organizationId) {
      throw new Error('Course not found');
    }
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user || user.organizationId !== args.organizationId) {
        throw new Error('User not found in organization');
      }
    }

    const now = Date.now();
    let enrolledCount = 0;

    for (const userId of args.userIds) {
      const existing = await ctx.db
        .query('enrollments')
        .withIndex('by_user_course', (q) =>
          q
            .eq('organizationId', args.organizationId)
            .eq('userId', userId)
            .eq('courseId', args.courseId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('enrollments', {
          organizationId: args.organizationId,
          userId,
          courseId: args.courseId,
          status: 'not_started',
          progress: 0,
          enrolledBy: requesterId,
          createdAt: now,
          updatedAt: now,
        });
        enrolledCount++;
      }
    }

    return { success: true, enrolledCount };
  },
});

export const updateEnrollmentStatus = mutation({
  args: {
    enrollmentId: v.id('enrollments'),
    status: v.union(
      v.literal('not_started'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('expired'),
    ),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');
    const { requesterId, isSuperadmin } = await checkAccess(ctx, enrollment.organizationId);
    if (!isSuperadmin && enrollment.userId !== requesterId) {
      throw new Error('Access denied');
    }
    if (
      args.progress !== undefined &&
      (!Number.isFinite(args.progress) || args.progress < 0 || args.progress > 100)
    ) {
      throw new Error('Progress must be between 0 and 100');
    }

    const evidence = await courseCompletion(
      ctx,
      enrollment.organizationId,
      enrollment.courseId,
      enrollment.userId,
    );
    if (args.status === 'completed' && !evidence.complete) throw new Error('Course not completed');
    if (args.progress !== undefined && args.progress !== evidence.progress) {
      throw new Error('Progress must match server evidence');
    }
    const patch: Partial<Doc<'enrollments'>> = {
      status: args.status,
      progress: evidence.progress,
      updatedAt: Date.now(),
    };
    if (args.status === 'in_progress' && !enrollment.startedAt) patch.startedAt = Date.now();
    if (args.status === 'completed') {
      patch.completedAt = Date.now();
      patch.progress = 100;
    }

    await ctx.db.patch(args.enrollmentId, patch);
    return { success: true };
  },
});

// ─── LESSON PROGRESS ─────────────────────────────────────────────────────────

export const getLessonProgress = query({
  args: {
    organizationId: v.id('organizations'),
    lessonId: v.id('lessons'),
  },
  handler: async (ctx, args) => {
    const { requesterId } = await checkAccess(ctx, args.organizationId);
    return await ctx.db
      .query('lessonProgress')
      .withIndex('by_user_lesson', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('lessonId', args.lessonId),
      )
      .first();
  },
});

export const updateLessonProgress = mutation({
  args: {
    organizationId: v.id('organizations'),
    lessonId: v.id('lessons'),
    courseId: v.id('courses'),
    isCompleted: v.boolean(),
    timeSpentSeconds: v.optional(v.number()),
    lastPosition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const course = await ctx.db.get(args.courseId);
    const lesson = await ctx.db.get(args.lessonId);
    if (
      !course ||
      course.organizationId !== args.organizationId ||
      !lesson ||
      lesson.organizationId !== args.organizationId ||
      lesson.courseId !== course._id
    ) {
      throw new Error('Lesson not found');
    }
    await requireReadableCourse(ctx, args.organizationId, args.courseId, isSuperadmin);
    const activeEnrollment = await ctx.db
      .query('enrollments')
      .withIndex('by_user_course', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('courseId', args.courseId),
      )
      .first();
    if (
      !activeEnrollment ||
      activeEnrollment.status === 'expired' ||
      (activeEnrollment.expiresAt !== undefined && activeEnrollment.expiresAt <= Date.now())
    ) {
      throw new Error('Active enrollment required');
    }
    for (const value of [args.timeSpentSeconds, args.lastPosition]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Invalid lesson progress');
      }
    }
    if (args.isCompleted) {
      const quizzes = await ctx.db
        .query('quizzes')
        .withIndex('by_lesson', (q) =>
          q.eq('organizationId', args.organizationId).eq('lessonId', lesson._id),
        )
        .take(DEFAULT_LIST_CAP + 1);
      if (quizzes.length > DEFAULT_LIST_CAP) throw new Error('Course exceeds completion limit');
      if (lesson.contentType === 'quiz' && quizzes.length === 0) throw new Error('Quiz required');
      for (const quiz of quizzes) {
        await assertReadableQuiz(ctx, args.organizationId, quiz, false);
        const passed = await ctx.db
          .query('quizAttempts')
          .withIndex('by_user_quiz', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('userId', requesterId)
              .eq('quizId', quiz._id),
          )
          .filter((q) => q.eq(q.field('passed'), true))
          .first();
        if (!passed) throw new Error('Quiz must be passed');
      }
    }

    const existing = await ctx.db
      .query('lessonProgress')
      .withIndex('by_user_lesson', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('lessonId', args.lessonId),
      )
      .first();

    const now = Date.now();
    if (existing) {
      const patch: Partial<Doc<'lessonProgress'>> = {
        isCompleted: args.isCompleted,
        updatedAt: now,
      };
      if (args.timeSpentSeconds !== undefined) {
        patch.timeSpentSeconds = (existing.timeSpentSeconds ?? 0) + args.timeSpentSeconds;
      }
      if (args.lastPosition !== undefined) patch.lastPosition = args.lastPosition;
      if (args.isCompleted && !existing.completedAt) patch.completedAt = now;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert('lessonProgress', {
        organizationId: args.organizationId,
        userId: requesterId,
        lessonId: args.lessonId,
        courseId: args.courseId,
        isCompleted: args.isCompleted,
        timeSpentSeconds: args.timeSpentSeconds ?? 0,
        lastPosition: args.lastPosition,
        completedAt: args.isCompleted ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    const evidence = await courseCompletion(ctx, args.organizationId, args.courseId, requesterId);
    const progressPercent = evidence.progress;
    const enrollment = evidence.enrollment;

    if (enrollment) {
      const enrollmentPatch: Partial<Doc<'enrollments'>> = {
        progress: progressPercent,
        updatedAt: now,
      };

      // Auto-transition status
      if (progressPercent > 0 && enrollment.status === 'not_started') {
        enrollmentPatch.status = 'in_progress';
        enrollmentPatch.startedAt = now;
      }

      if (!evidence.complete && enrollment.status === 'completed') {
        enrollmentPatch.status = 'in_progress';
        enrollmentPatch.completedAt = undefined;
      }
      // Auto-complete only when all server evidence is present.
      if (evidence.complete && enrollment.status !== 'completed') {
        enrollmentPatch.status = 'completed';
        enrollmentPatch.completedAt = now;
      }

      await ctx.db.patch(enrollment._id, enrollmentPatch);

      // Auto-issue certificate on course completion
      if (evidence.complete) {
        const existingCert = await ctx.db
          .query('certificates')
          .withIndex('by_user_course', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('userId', requesterId)
              .eq('courseId', args.courseId),
          )
          .first();

        if (!existingCert) {
          const course = await ctx.db.get(args.courseId);
          const cv = course?.contentVersion ?? 1;
          const certId = `CERT-${args.organizationId}-${requesterId}-${args.courseId}-${now}`;
          await ctx.db.insert('certificates', {
            organizationId: args.organizationId,
            userId: requesterId,
            courseId: args.courseId,
            certificateId: certId,
            issuedAt: now,
            contentVersion: cv,
            isOutdated: false,
            createdAt: now,
          });
        } else if (existingCert.contentVersion !== undefined) {
          const course = await ctx.db.get(args.courseId);
          const cv = course?.contentVersion ?? 1;
          if (existingCert.contentVersion !== cv) {
            await ctx.db.patch(existingCert._id, { isOutdated: true });
          }
        }
      }
    }

    return { success: true, progress: progressPercent };
  },
});

// ─── QUIZZES ─────────────────────────────────────────────────────────────────

export const getQuiz = query({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.organizationId !== args.organizationId) {
      throw new Error('Quiz not found');
    }
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);

    const questionRows = await ctx.db
      .query('quizQuestions')
      .withIndex('by_quiz', (q) =>
        q.eq('organizationId', args.organizationId).eq('quizId', quiz._id),
      )
      .order('asc')
      .take(DEFAULT_LIST_CAP + 1);
    const isCapped = questionRows.length > DEFAULT_LIST_CAP;
    const questions = questionRows.slice(0, DEFAULT_LIST_CAP);

    return {
      quiz,
      questions: questions.map((question) => readableQuestion(question, isSuperadmin)),
      isCapped,
    };
  },
});

/** Paginated quiz questions. Legacy getQuiz remains for small quizzes. */
export const getQuizQuestionsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.organizationId !== args.organizationId) {
      throw new Error('Quiz not found');
    }
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);
    const result = await ctx.db
      .query('quizQuestions')
      .withIndex('by_quiz', (q) =>
        q.eq('organizationId', args.organizationId).eq('quizId', quiz._id),
      )
      .order('asc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    return {
      ...result,
      page: result.page.map((question) => readableQuestion(question, isSuperadmin)),
    };
  },
});

export const getQuizByLesson = query({
  args: {
    organizationId: v.id('organizations'),
    lessonId: v.id('lessons'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);

    const quiz = await ctx.db
      .query('quizzes')
      .withIndex('by_lesson', (q) =>
        q.eq('organizationId', args.organizationId).eq('lessonId', args.lessonId),
      )
      .first();

    if (!quiz || (!isSuperadmin && !quiz.isPublished)) return null;
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);

    const questionRows = await ctx.db
      .query('quizQuestions')
      .withIndex('by_quiz', (q) =>
        q.eq('organizationId', args.organizationId).eq('quizId', quiz._id),
      )
      .order('asc')
      .take(DEFAULT_LIST_CAP + 1);
    const isCapped = questionRows.length > DEFAULT_LIST_CAP;
    const questions = questionRows.slice(0, DEFAULT_LIST_CAP);

    return {
      quiz,
      questions: questions.map((question) => readableQuestion(question, isSuperadmin)),
      isCapped,
    };
  },
});

/** Paginated quiz questions by lesson quiz. */
export const getQuizByLessonQuestionsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    lessonId: v.id('lessons'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const quiz = await ctx.db
      .query('quizzes')
      .withIndex('by_lesson', (q) =>
        q.eq('organizationId', args.organizationId).eq('lessonId', args.lessonId),
      )
      .first();
    if (!quiz) throw new Error('Quiz not found');
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);
    const result = await ctx.db
      .query('quizQuestions')
      .withIndex('by_quiz', (q) =>
        q.eq('organizationId', args.organizationId).eq('quizId', quiz._id),
      )
      .order('asc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    return {
      ...result,
      page: result.page.map((question) => readableQuestion(question, isSuperadmin)),
    };
  },
});

export const getQuizAttemptsForUser = query({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
  },
  handler: async (ctx, args) => {
    const { requesterId } = await checkAccess(ctx, args.organizationId);

    return await ctx.db
      .query('quizAttempts')
      .withIndex('by_user_quiz', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('quizId', args.quizId),
      )
      .order('desc')
      .take(DEFAULT_LIST_CAP);
  },
});

export const createQuiz = mutation({
  args: {
    organizationId: v.id('organizations'),
    courseId: v.optional(v.id('courses')),
    lessonId: v.optional(v.id('lessons')),
    title: v.string(),
    description: v.optional(v.string()),
    passingScore: v.number(),
    timeLimitMinutes: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can create quizzes');
    if (args.courseId) {
      const course = await ctx.db.get(args.courseId);
      if (!course || course.organizationId !== args.organizationId) {
        throw new Error('Course not found');
      }
    }
    if (args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (
        !lesson ||
        lesson.organizationId !== args.organizationId ||
        (args.courseId && lesson.courseId !== args.courseId)
      ) {
        throw new Error('Lesson not found');
      }
    }

    const now = Date.now();
    const quizId = await ctx.db.insert('quizzes', {
      organizationId: args.organizationId,
      courseId: args.courseId,
      lessonId: args.lessonId,
      title: args.title,
      description: args.description,
      passingScore: args.passingScore,
      timeLimitMinutes: args.timeLimitMinutes,
      maxAttempts: args.maxAttempts,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
    if (args.courseId) {
      const course = await ctx.db.get(args.courseId);
      if (course)
        await ctx.db.patch(course._id, {
          contentVersion: (course.contentVersion ?? 1) + 1,
          updatedAt: now,
        });
    } else if (args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (lesson) {
        const course = await ctx.db.get(lesson.courseId);
        if (course)
          await ctx.db.patch(course._id, {
            contentVersion: (course.contentVersion ?? 1) + 1,
            updatedAt: now,
          });
      }
    }
    return quizId;
  },
});

export const createQuizQuestion = mutation({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
    questionText: v.string(),
    questionType: v.union(
      v.literal('multiple_choice'),
      v.literal('true_false'),
      v.literal('short_answer'),
    ),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.string(),
    points: v.optional(v.number()),
    explanation: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can create quiz questions');
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.organizationId !== args.organizationId) throw new Error('Quiz not found');

    const now = Date.now();
    const id = await ctx.db.insert('quizQuestions', {
      organizationId: args.organizationId,
      quizId: args.quizId,
      questionText: args.questionText,
      questionType: args.questionType,
      options: args.options,
      correctAnswer: args.correctAnswer,
      points: args.points ?? 1,
      explanation: args.explanation,
      order: args.order,
      createdAt: now,
      updatedAt: now,
    });
    if (quiz.courseId) {
      const course = await ctx.db.get(quiz.courseId);
      if (course)
        await ctx.db.patch(course._id, {
          contentVersion: (course.contentVersion ?? 1) + 1,
          updatedAt: now,
        });
    } else if (quiz.lessonId) {
      const lesson = await ctx.db.get(quiz.lessonId);
      if (lesson) {
        const course = await ctx.db.get(lesson.courseId);
        if (course)
          await ctx.db.patch(course._id, {
            contentVersion: (course.contentVersion ?? 1) + 1,
            updatedAt: now,
          });
      }
    }
    return id;
  },
});

export const startQuizAttempt = mutation({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.organizationId !== args.organizationId) throw new Error('Quiz not found');
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);
    if (
      quiz.timeLimitMinutes !== undefined &&
      (!Number.isFinite(quiz.timeLimitMinutes) || quiz.timeLimitMinutes <= 0)
    ) {
      throw new Error('Invalid time limit');
    }
    if (
      quiz.maxAttempts !== undefined &&
      (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1)
    ) {
      throw new Error('Invalid maximum attempts');
    }
    if (quiz.timeLimitMinutes !== undefined) {
      const unfinished = await ctx.db
        .query('quizAttempts')
        .withIndex('by_user_quiz', (q) =>
          q
            .eq('organizationId', args.organizationId)
            .eq('userId', requesterId)
            .eq('quizId', quiz._id),
        )
        .filter((q) => q.eq(q.field('completedAt'), undefined))
        .order('desc')
        .first();
      if (unfinished) {
        const deadline = unfinished.expiresAt ?? unfinished.startedAt + 24 * 60 * 60 * 1000;
        if (Date.now() < deadline) throw new Error('Quiz already in progress');
      }
    }
    const attemptCount = await ctx.db
      .query('quizAttempts')
      .withIndex('by_user_quiz', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', requesterId)
          .eq('quizId', quiz._id),
      )
      .take(DEFAULT_LIST_CAP + 1);
    if (attemptCount.length > DEFAULT_LIST_CAP) throw new Error('Quiz exceeds attempt limit');
    if (quiz.maxAttempts !== undefined && attemptCount.length + 1 > quiz.maxAttempts) {
      throw new Error(`Maximum attempts (${quiz.maxAttempts}) exceeded`);
    }
    const now = Date.now();
    const expiresAt =
      quiz.timeLimitMinutes !== undefined ? now + quiz.timeLimitMinutes * 60 * 1000 : undefined;
    const attemptNumber = attemptCount.length + 1;
    const id = await ctx.db.insert('quizAttempts', {
      organizationId: args.organizationId,
      userId: requesterId,
      quizId: quiz._id,
      score: 0,
      passed: false,
      answers: [],
      startedAt: now,
      completedAt: undefined,
      expiresAt,
      attemptNumber,
      createdAt: now,
    });
    return { attemptId: id, attemptNumber, startedAt: now, expiresAt };
  },
});

export const submitQuizAttempt = mutation({
  args: {
    organizationId: v.id('organizations'),
    quizId: v.id('quizzes'),
    answers: v.array(
      v.object({
        questionId: v.optional(v.id('quizQuestions')),
        userAnswer: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const { requesterId, isSuperadmin } = await checkAccess(ctx, args.organizationId);

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.organizationId !== args.organizationId) throw new Error('Quiz not found');
    await assertReadableQuiz(ctx, args.organizationId, quiz, isSuperadmin);

    const questions = await ctx.db
      .query('quizQuestions')
      .withIndex('by_quiz', (q) =>
        q.eq('organizationId', args.organizationId).eq('quizId', quiz._id),
      )
      .order('asc')
      .take(DEFAULT_LIST_CAP + 1);

    if (questions.length === 0) throw new Error('Quiz has no questions');
    // Bounded grading must fail closed rather than certify a truncated quiz.
    if (questions.length > DEFAULT_LIST_CAP) throw new Error('Quiz exceeds grading limit');
    if (questions.some((q) => !Number.isFinite(q.points ?? 1) || (q.points ?? 1) <= 0)) {
      throw new Error('Invalid quiz points');
    }
    if (!Number.isFinite(quiz.passingScore) || quiz.passingScore < 0 || quiz.passingScore > 100) {
      throw new Error('Invalid passing score');
    }

    const answers = args.answers;
    const keyed = answers.some((answer) => answer.questionId !== undefined);
    const byId = new Map(questions.map((question) => [question._id, question]));
    const seen = new Set<Id<'quizQuestions'>>();
    if (answers.length > questions.length) throw new Error('Too many quiz answers');
    let earnedPoints = 0;
    const answerResults = answers.map((answer, idx) => {
      // ID-bearing submissions may be in any order. Legacy arrays retain the
      // creation-order contract used by getQuiz/getQuizByLesson.
      const question = keyed ? answer.questionId && byId.get(answer.questionId) : questions[idx];
      if (!question || seen.has(question._id)) throw new Error('Invalid quiz answers');
      seen.add(question._id);
      const isCorrect = answer.userAnswer === question.correctAnswer;
      if (isCorrect) earnedPoints += question.points ?? 1;
      return { questionId: question._id, userAnswer: answer.userAnswer, isCorrect };
    });
    const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
    if (!Number.isFinite(totalPoints)) throw new Error('Invalid quiz points');
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= quiz.passingScore;

    // Authoritative time-limit: if a timed quiz was started, enforce its deadline; otherwise require a pre-started session.
    const now = Date.now();
    let attemptToComplete: Doc<'quizAttempts'> | null = null;
    if (quiz.timeLimitMinutes !== undefined) {
      const pending = await ctx.db
        .query('quizAttempts')
        .withIndex('by_user_quiz', (q) =>
          q
            .eq('organizationId', args.organizationId)
            .eq('userId', requesterId)
            .eq('quizId', quiz._id),
        )
        .filter((q) => q.eq(q.field('completedAt'), undefined))
        .order('desc')
        .first();
      if (!pending) throw new Error('Quiz not started');
      const deadline = pending.expiresAt ?? pending.startedAt + quiz.timeLimitMinutes * 60 * 1000;
      if (now > deadline) {
        await ctx.db.patch(pending._id, { completedAt: now, score: 0, passed: false, answers: [] });
        throw new Error('Time limit exceeded');
      }
      attemptToComplete = pending;
    } else {
      const attemptCount = await ctx.db
        .query('quizAttempts')
        .withIndex('by_user_quiz', (q) =>
          q
            .eq('organizationId', args.organizationId)
            .eq('userId', requesterId)
            .eq('quizId', quiz._id),
        )
        .take(DEFAULT_LIST_CAP + 1);
      if (attemptCount.length > DEFAULT_LIST_CAP) throw new Error('Quiz exceeds attempt limit');
      const attemptNumber = attemptCount.length + 1;
      if (
        quiz.maxAttempts !== undefined &&
        (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1)
      ) {
        throw new Error('Invalid maximum attempts');
      }
      if (quiz.maxAttempts !== undefined && attemptNumber > quiz.maxAttempts) {
        throw new Error(`Maximum attempts (${quiz.maxAttempts}) exceeded`);
      }
      // For untimed quizzes we create the attempt here with its results (backward compat: no explicit start required).
      await ctx.db.insert('quizAttempts', {
        organizationId: args.organizationId,
        userId: requesterId,
        quizId: quiz._id,
        score,
        passed,
        answers: answerResults,
        startedAt: now,
        completedAt: now,
        attemptNumber,
        createdAt: now,
      });
      return { success: true, score, passed, attemptNumber };
    }
    // Complete the authoritative pending attempt for timed quizzes.
    const patchAttemptNumber = attemptToComplete!.attemptNumber;
    await ctx.db.patch(attemptToComplete!._id, {
      score,
      passed,
      answers: answerResults,
      completedAt: now,
    });
    return { success: true, score, passed, attemptNumber: patchAttemptNumber };
  },
});

// ─── CERTIFICATES ────────────────────────────────────────────────────────────

export const getMyCertificates = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { requesterId } = await checkAccess(ctx, args.organizationId);
    const certificates = await ctx.db
      .query('certificates')
      .withIndex('by_user', (q) =>
        q.eq('organizationId', args.organizationId).eq('userId', requesterId),
      )
      .take(DEFAULT_LIST_CAP);

    const enriched = await Promise.all(
      certificates.map(async (cert) => {
        const course = await ctx.db.get(cert.courseId);
        return { ...cert, courseTitle: course?.title ?? 'Unknown Course' };
      }),
    );

    return enriched;
  },
});

/** Cursor-based personal certificate history; legacy array API stays compatible. */
export const getMyCertificatesPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { requesterId } = await checkAccess(ctx, args.organizationId);
    const result = await ctx.db
      .query('certificates')
      .withIndex('by_user', (q) =>
        q.eq('organizationId', args.organizationId).eq('userId', requesterId),
      )
      .order('desc')
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    const page = await Promise.all(
      result.page.map(async (cert) => {
        const course = await ctx.db.get(cert.courseId);
        return {
          ...cert,
          courseTitle:
            course?.organizationId === args.organizationId ? course.title : 'Unknown Course',
        };
      }),
    );
    return { ...result, page };
  },
});

export const getOrgCertificates = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view org certificates');

    const certificates = await ctx.db
      .query('certificates')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP);

    return certificates;
  },
});

export const issueCertificate = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    courseId: v.id('courses'),
    templateId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'learning');
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can issue certificates');
    const course = await ctx.db.get(args.courseId);
    const user = await ctx.db.get(args.userId);
    if (!course || course.organizationId !== args.organizationId) {
      throw new Error('Course not found');
    }
    if (!user || user.organizationId !== args.organizationId || !user.isActive) {
      throw new Error('User not found in organization');
    }

    const evidence = await courseCompletion(ctx, args.organizationId, args.courseId, args.userId);
    if (!evidence.complete) throw new Error('Course not completed');

    const existing = await ctx.db
      .query('certificates')
      .withIndex('by_user_course', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .eq('userId', args.userId)
          .eq('courseId', args.courseId),
      )
      .first();

    if (existing) {
      return { success: false, message: 'Certificate already issued for this course' };
    }

    const certificateId = `CERT-${args.organizationId}-${args.userId}-${args.courseId}-${Date.now()}`;
    const now = Date.now();
    const cv = course.contentVersion ?? 1;

    await ctx.db.insert('certificates', {
      organizationId: args.organizationId,
      userId: args.userId,
      courseId: args.courseId,
      certificateId,
      templateId: args.templateId,
      issuedAt: now,
      expiresAt: args.expiresAt,
      contentVersion: cv,
      isOutdated: false,
      metadata: args.metadata as Record<string, unknown> | undefined,
      createdAt: now,
    });

    return { success: true, certificateId };
  },
});

// ─── COURSE CATEGORIES ───────────────────────────────────────────────────────

export const getCourseCategories = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await checkAccess(ctx, args.organizationId);
    const rows = await ctx.db
      .query('courseCategories')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .order('asc')
      .take(DEFAULT_LIST_CAP + 1);
    const isCapped = rows.length > DEFAULT_LIST_CAP;
    void isCapped;
    return rows.slice(0, DEFAULT_LIST_CAP);
  },
});

export const createCourseCategory = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can create categories');

    const now = Date.now();
    return await ctx.db.insert('courseCategories', {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      icon: args.icon,
      color: args.color,
      order: args.order ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── TEAM/ADMIN LEARNING OVERVIEW ────────────────────────────────────────────

export const getTeamLearningOverview = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view team overview');

    const enrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);

    const isCapped = enrollments.length > DEFAULT_LIST_CAP || courses.length > DEFAULT_LIST_CAP;
    const enrollmentSample = enrollments.slice(0, DEFAULT_LIST_CAP);
    const courseSample = courses.slice(0, DEFAULT_LIST_CAP);
    const totalEnrollments = enrollmentSample.length;
    const completedEnrollments = enrollmentSample.filter((e) => e.status === 'completed').length;
    const inProgressEnrollments = enrollmentSample.filter((e) => e.status === 'in_progress').length;
    const totalCourses = courseSample.length;
    const mandatoryCourses = courseSample.filter((c) => c.isMandatory).length;

    const completionRate =
      totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

    return {
      isCapped,
      totalEnrollments,
      completedEnrollments,
      inProgressEnrollments,
      totalCourses,
      mandatoryCourses,
      completionRate,
    };
  },
});

// ─── ENROLLMENT DETAILS (for stat card drills) ──────────────────────────────

/** Cursor-paginated enrollment list for a stat card drill-down. */
export const getEnrollmentDetails = query({
  args: {
    organizationId: v.id('organizations'),
    paginationOpts: paginationOptsValidator,
    filter: v.union(
      v.literal('all'),
      v.literal('completed'),
      v.literal('in_progress'),
      v.literal('not_started'),
      v.literal('mandatory'),
    ),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view enrollment details');

    const enrollmentQuery = ctx.db.query('enrollments');
    const statusFilter = args.filter;
    const scopedQuery =
      statusFilter === 'completed' ||
      statusFilter === 'in_progress' ||
      statusFilter === 'not_started'
        ? enrollmentQuery.withIndex('by_status', (q) =>
            q.eq('organizationId', args.organizationId).eq('status', statusFilter),
          )
        : enrollmentQuery.withIndex('by_org', (q) => q.eq('organizationId', args.organizationId));
    const result = await scopedQuery.paginate({
      ...args.paginationOpts,
      numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
    });

    const enriched = await Promise.all(
      result.page.map(async (enrollment) => {
        const user = await ctx.db.get(enrollment.userId);
        const course = await ctx.db.get(enrollment.courseId);
        const certificate = await ctx.db
          .query('certificates')
          .withIndex('by_user_course', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('userId', enrollment.userId)
              .eq('courseId', enrollment.courseId),
          )
          .first();
        return {
          hasCertificate: certificate !== null,
          _id: enrollment._id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          userName: user?.organizationId === args.organizationId ? user.name : 'Unknown',
          userEmail: user?.organizationId === args.organizationId ? user.email : '',
          userDepartment:
            user?.organizationId === args.organizationId ? user.department : undefined,
          courseTitle: course?.organizationId === args.organizationId ? course.title : 'Unknown',
          courseIsMandatory: course?.organizationId === args.organizationId && !!course.isMandatory,
          status: enrollment.status,
          progress: enrollment.progress ?? 0,
          enrolledAt: enrollment.createdAt,
          startedAt: enrollment.startedAt,
          completedAt: enrollment.completedAt,
        };
      }),
    );

    // Mandatory is a course property: pages may be empty, but their cursor still advances.
    return {
      ...result,
      page:
        args.filter === 'mandatory' ? enriched.filter((row) => row.courseIsMandatory) : enriched,
    };
  },
});

/** Course list with enrollment counts. Counts are capped; see isCapped. */
export const getCoursesWithCounts = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view course details');

    const courses = await ctx.db
      .query('courses')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);
    const allEnrollments = await ctx.db
      .query('enrollments')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);
    const isCapped = courses.length > DEFAULT_LIST_CAP || allEnrollments.length > DEFAULT_LIST_CAP;
    const courseSample = courses.slice(0, DEFAULT_LIST_CAP);
    const enrollmentSample = allEnrollments.slice(0, DEFAULT_LIST_CAP);

    return {
      isCapped,
      courses: courseSample.map((course) => {
        const courseEnrollments = enrollmentSample.filter((e) => e.courseId === course._id);
        return {
          _id: course._id,
          title: course.title,
          category: course.category,
          isMandatory: course.isMandatory,
          isPublished: course.isPublished,
          enrollmentCount: courseEnrollments.length,
          completedCount: courseEnrollments.filter((e) => e.status === 'completed').length,
          inProgressCount: courseEnrollments.filter((e) => e.status === 'in_progress').length,
        };
      }),
    };
  },
});

/** Paginated course list with enrollment counts. */
export const getCoursesWithCountsPaginated = query({
  args: {
    organizationId: v.id('organizations'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { isSuperadmin } = await checkAccess(ctx, args.organizationId);
    if (!isSuperadmin) throw new Error('Only admins can view course details');
    const result = await ctx.db
      .query('courses')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(MAX_PAGE_SIZE, Math.max(1, args.paginationOpts.numItems)),
      });
    const page = await Promise.all(
      result.page.map(async (course) => {
        const enrollments = await ctx.db
          .query('enrollments')
          .withIndex('by_course', (q) =>
            q.eq('organizationId', args.organizationId).eq('courseId', course._id),
          )
          .take(DEFAULT_LIST_CAP + 1);
        const isCapped = enrollments.length > DEFAULT_LIST_CAP;
        const sample = enrollments.slice(0, DEFAULT_LIST_CAP);
        return {
          _id: course._id,
          title: course.title,
          category: course.category,
          isMandatory: course.isMandatory,
          isPublished: course.isPublished,
          enrollmentCount: sample.length,
          completedCount: sample.filter((e) => e.status === 'completed').length,
          inProgressCount: sample.filter((e) => e.status === 'in_progress').length,
          isCapped,
        };
      }),
    );
    return { ...result, page };
  },
});
