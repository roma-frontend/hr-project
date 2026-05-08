import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { MAX_PAGE_SIZE } from './pagination';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List surveys for an organization, optionally filtered by status
 */
export const listSurveys = query({
  args: {
    organizationId: v.id('organizations'),
    status: v.optional(v.union(v.literal('draft'), v.literal('active'), v.literal('closed'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { organizationId, status, limit }) => {
    const pageSize = Math.min(limit ?? 50, MAX_PAGE_SIZE);

    let surveyQuery;
    if (status) {
      surveyQuery = ctx.db
        .query('surveys')
        .withIndex('by_org_status', (q) =>
          q.eq('organizationId', organizationId).eq('status', status),
        );
    } else {
      surveyQuery = ctx.db
        .query('surveys')
        .withIndex('by_org_created', (q) => q.eq('organizationId', organizationId));
    }

    const surveys = await surveyQuery.order('desc').take(pageSize);

    // Batch load creators
    const creatorIds = [...new Set(surveys.map((s) => s.createdBy))];
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = new Map(creators.filter(Boolean).map((u) => [u!._id, u!]));

    return surveys.map((survey) => ({
      ...survey,
      creator: creatorMap.get(survey.createdBy)
        ? {
            name: creatorMap.get(survey.createdBy)!.name,
            avatarUrl: (creatorMap.get(survey.createdBy) as any)?.avatarUrl,
          }
        : null,
    }));
  },
});

/**
 * Get a single survey with its questions
 */
export const getSurveyWithQuestions = query({
  args: {
    surveyId: v.id('surveys'),
  },
  handler: async (ctx, { surveyId }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey) return null;

    const questions = await ctx.db
      .query('surveyQuestions')
      .withIndex('by_survey_order', (q) => q.eq('surveyId', surveyId))
      .collect();

    const creator = await ctx.db.get(survey.createdBy);

    return {
      ...survey,
      questions,
      creator: creator ? { name: creator.name, avatarUrl: (creator as any)?.avatarUrl } : null,
    };
  },
});

/**
 * Get survey results/analytics
 */
export const getSurveyResults = query({
  args: {
    surveyId: v.id('surveys'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { surveyId, organizationId }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey || survey.organizationId !== organizationId) return null;

    const questions = await ctx.db
      .query('surveyQuestions')
      .withIndex('by_survey_order', (q) => q.eq('surveyId', surveyId))
      .collect();

    const responses = await ctx.db
      .query('surveyResponses')
      .withIndex('by_survey', (q) => q.eq('surveyId', surveyId))
      .collect();

    const answers = await ctx.db
      .query('surveyAnswers')
      .withIndex('by_survey', (q) => q.eq('surveyId', surveyId))
      .collect();

    // Aggregate answers per question
    const questionResults = questions.map((question) => {
      const questionAnswers = answers.filter((a) => a.questionId === question._id);

      const aggregation: any = { totalResponses: questionAnswers.length };

      switch (question.type) {
        case 'rating':
        case 'nps': {
          const values = questionAnswers
            .map((a) => a.ratingValue)
            .filter((v): v is number => v !== undefined);
          aggregation.average =
            values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
          aggregation.distribution = values.reduce(
            (acc, val) => {
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            },
            {} as Record<number, number>,
          );
          break;
        }
        case 'multiple_choice': {
          const optionCounts: Record<string, number> = {};
          questionAnswers.forEach((a) => {
            a.selectedOptions?.forEach((opt) => {
              optionCounts[opt] = (optionCounts[opt] || 0) + 1;
            });
          });
          aggregation.optionCounts = optionCounts;
          break;
        }
        case 'yes_no': {
          const yesCount = questionAnswers.filter((a) => a.booleanValue === true).length;
          const noCount = questionAnswers.filter((a) => a.booleanValue === false).length;
          aggregation.yesCount = yesCount;
          aggregation.noCount = noCount;
          break;
        }
        case 'text': {
          aggregation.textResponses = questionAnswers.map((a) => a.textValue).filter(Boolean);
          break;
        }
      }

      return {
        question,
        ...aggregation,
      };
    });

    return {
      survey,
      totalResponses: responses.length,
      questionResults,
    };
  },
});

/**
 * Check if user has already responded to a survey
 */
export const hasUserResponded = query({
  args: {
    surveyId: v.id('surveys'),
    userId: v.id('users'),
  },
  handler: async (ctx, { surveyId, userId }) => {
    const existing = await ctx.db
      .query('surveyResponses')
      .withIndex('by_survey_respondent', (q) =>
        q.eq('surveyId', surveyId).eq('respondentId', userId),
      )
      .first();
    return !!existing;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new survey (admin/supervisor only)
 */
export const createSurvey = mutation({
  args: {
    organizationId: v.id('organizations'),
    createdBy: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    isAnonymous: v.boolean(),
    targetRoles: v.optional(
      v.array(
        v.union(
          v.literal('admin'),
          v.literal('supervisor'),
          v.literal('employee'),
          v.literal('driver'),
        ),
      ),
    ),
    targetDepartments: v.optional(v.array(v.string())),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    questions: v.array(
      v.object({
        type: v.union(
          v.literal('rating'),
          v.literal('multiple_choice'),
          v.literal('text'),
          v.literal('yes_no'),
          v.literal('nps'),
        ),
        text: v.string(),
        description: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        isRequired: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const surveyId = await ctx.db.insert('surveys', {
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      createdBy: args.createdBy,
      status: 'draft',
      isAnonymous: args.isAnonymous,
      targetRoles: args.targetRoles,
      targetDepartments: args.targetDepartments,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      responseCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Create questions
    for (let i = 0; i < args.questions.length; i++) {
      const q = args.questions[i]!;
      await ctx.db.insert('surveyQuestions', {
        organizationId: args.organizationId,
        surveyId,
        type: q.type,
        text: q.text,
        description: q.description,
        options: q.options,
        isRequired: q.isRequired,
        order: i,
        createdAt: now,
      });
    }

    return surveyId;
  },
});

/**
 * Publish a survey (change status from draft to active)
 */
export const publishSurvey = mutation({
  args: {
    surveyId: v.id('surveys'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { surveyId, organizationId }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey || survey.organizationId !== organizationId) {
      throw new Error('Survey not found');
    }
    if (survey.status !== 'draft') {
      throw new Error('Only draft surveys can be published');
    }

    await ctx.db.patch(surveyId, {
      status: 'active',
      startsAt: survey.startsAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Close a survey
 */
export const closeSurvey = mutation({
  args: {
    surveyId: v.id('surveys'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { surveyId, organizationId }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey || survey.organizationId !== organizationId) {
      throw new Error('Survey not found');
    }
    if (survey.status !== 'active') {
      throw new Error('Only active surveys can be closed');
    }

    await ctx.db.patch(surveyId, {
      status: 'closed',
      endsAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a survey (admin only, draft surveys only)
 */
export const deleteSurvey = mutation({
  args: {
    surveyId: v.id('surveys'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { surveyId, organizationId }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey || survey.organizationId !== organizationId) {
      throw new Error('Survey not found');
    }
    if (survey.status !== 'draft') {
      throw new Error('Only draft surveys can be deleted');
    }

    // Delete questions
    const questions = await ctx.db
      .query('surveyQuestions')
      .withIndex('by_survey', (q) => q.eq('surveyId', surveyId))
      .collect();
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    await ctx.db.delete(surveyId);
  },
});

/**
 * Submit a survey response
 */
export const submitResponse = mutation({
  args: {
    organizationId: v.id('organizations'),
    surveyId: v.id('surveys'),
    respondentId: v.optional(v.id('users')),
    answers: v.array(
      v.object({
        questionId: v.id('surveyQuestions'),
        ratingValue: v.optional(v.number()),
        textValue: v.optional(v.string()),
        selectedOptions: v.optional(v.array(v.string())),
        booleanValue: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey || survey.organizationId !== args.organizationId) {
      throw new Error('Survey not found');
    }
    if (survey.status !== 'active') {
      throw new Error('Survey is not active');
    }

    // Check duplicate response
    if (args.respondentId) {
      const existing = await ctx.db
        .query('surveyResponses')
        .withIndex('by_survey_respondent', (q) =>
          q.eq('surveyId', args.surveyId).eq('respondentId', args.respondentId!),
        )
        .first();
      if (existing) {
        throw new Error('You have already responded to this survey');
      }
    }

    const now = Date.now();

    // Create response record
    const responseId = await ctx.db.insert('surveyResponses', {
      organizationId: args.organizationId,
      surveyId: args.surveyId,
      respondentId: args.respondentId,
      anonymousToken: survey.isAnonymous
        ? `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`
        : undefined,
      submittedAt: now,
    });

    // Insert answers
    for (const answer of args.answers) {
      await ctx.db.insert('surveyAnswers', {
        organizationId: args.organizationId,
        surveyId: args.surveyId,
        responseId,
        questionId: answer.questionId,
        ratingValue: answer.ratingValue,
        textValue: answer.textValue,
        selectedOptions: answer.selectedOptions,
        booleanValue: answer.booleanValue,
        createdAt: now,
      });
    }

    // Increment response count
    await ctx.db.patch(args.surveyId, {
      responseCount: survey.responseCount + 1,
      updatedAt: now,
    });

    return responseId;
  },
});

/**
 * Reorder survey questions (drag-and-drop)
 */
export const reorderQuestions = mutation({
  args: {
    surveyId: v.id('surveys'),
    organizationId: v.id('organizations'),
    questionIds: v.array(v.id('surveyQuestions')),
  },
  handler: async (ctx, { surveyId, organizationId, questionIds }) => {
    const survey = await ctx.db.get(surveyId);
    if (!survey || survey.organizationId !== organizationId) {
      throw new Error('Survey not found');
    }

    const questions = await ctx.db
      .query('surveyQuestions')
      .withIndex('by_survey', (q) => q.eq('surveyId', surveyId))
      .collect();

    const questionMap = new Map(questions.map((q) => [q._id, q]));

    for (let i = 0; i < questionIds.length; i++) {
      const questionId = questionIds[i]!;
      const question = questionMap.get(questionId);
      if (question && question.order !== i) {
        await ctx.db.patch(questionId, { order: i });
      }
    }
  },
});

/**
 * Update an existing question's properties
 */
export const updateQuestion = mutation({
  args: {
    questionId: v.id('surveyQuestions'),
    organizationId: v.id('organizations'),
    text: v.optional(v.string()),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    options: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { questionId, organizationId, ...updates }) => {
    const question = await ctx.db.get(questionId);
    if (!question || question.organizationId !== organizationId) {
      throw new Error('Question not found');
    }

    const survey = await ctx.db.get(question.surveyId);
    if (!survey || survey.status !== 'draft') {
      throw new Error('Can only edit questions in draft surveys');
    }

    const patch: any = {};
    if (updates.text !== undefined) patch.text = updates.text;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.isRequired !== undefined) patch.isRequired = updates.isRequired;
    if (updates.options !== undefined) patch.options = updates.options;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(questionId, patch);
    }
  },
});

/**
 * Delete a single question from a survey
 */
export const deleteQuestion = mutation({
  args: {
    questionId: v.id('surveyQuestions'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { questionId, organizationId }) => {
    const question = await ctx.db.get(questionId);
    if (!question || question.organizationId !== organizationId) {
      throw new Error('Question not found');
    }

    const survey = await ctx.db.get(question.surveyId);
    if (!survey || survey.status !== 'draft') {
      throw new Error('Can only delete questions from draft surveys');
    }

    // Reorder remaining questions
    const remainingQuestions = await ctx.db
      .query('surveyQuestions')
      .withIndex('by_survey', (q) => q.eq('surveyId', question.surveyId))
      .collect();

    await ctx.db.delete(questionId);

    for (let i = 0; i < remainingQuestions.length; i++) {
      const q = remainingQuestions[i];
      if (q && q._id !== questionId && q.order !== i) {
        await ctx.db.patch(q._id, { order: i });
      }
    }
  },
});

// ── Internal: Auto-activate surveys when startsAt is reached (cron) ─────────
export const activateScheduledSurveys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all organizations
    const orgs = await ctx.db.query('organizations').collect();

    for (const org of orgs) {
      // Find draft surveys that should be active now
      const surveysToActivate = await ctx.db
        .query('surveys')
        .withIndex('by_org_status', (q) => q.eq('organizationId', org._id).eq('status', 'draft'))
        .filter((q) => q.and(q.lt(q.field('startsAt'), now), q.neq(q.field('startsAt'), undefined)))
        .collect();

      for (const survey of surveysToActivate) {
        await ctx.db.patch(survey._id, {
          status: 'active',
          updatedAt: now,
        });

        // Notify creators
        await ctx.db.insert('notifications', {
          organizationId: org._id,
          userId: survey.createdBy,
          type: 'survey_auto_activated',
          title: '📢 Survey Auto-Activated',
          message: `"${survey.title}" has been automatically activated as scheduled.`,
          isRead: false,
          relatedId: survey._id,
          route: '/surveys',
          createdAt: now,
        });
      }
    }
  },
});

// ── Internal: Auto-close surveys when endsAt is reached (cron) ─────────────
export const closeExpiredSurveys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all organizations
    const orgs = await ctx.db.query('organizations').collect();

    for (const org of orgs) {
      // Find active surveys that should be closed now
      const surveysToClose = await ctx.db
        .query('surveys')
        .withIndex('by_org_status', (q) => q.eq('organizationId', org._id).eq('status', 'active'))
        .filter((q) => q.and(q.lt(q.field('endsAt'), now), q.neq(q.field('endsAt'), undefined)))
        .collect();

      for (const survey of surveysToClose) {
        await ctx.db.patch(survey._id, {
          status: 'closed',
          endsAt: now,
          updatedAt: now,
        });

        // Notify creators
        await ctx.db.insert('notifications', {
          organizationId: org._id,
          userId: survey.createdBy,
          type: 'survey_auto_closed',
          title: '🔒 Survey Auto-Closed',
          message: `"${survey.title}" has been automatically closed as the end date has passed.`,
          isRead: false,
          relatedId: survey._id,
          route: '/surveys',
          createdAt: now,
        });
      }
    }
  },
});
