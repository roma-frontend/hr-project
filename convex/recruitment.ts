import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// ============ QUERIES ============

export const listVacancies = query({
  args: {
    organizationId: v.id('organizations'),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { organizationId, status }) => {
    let vacancies;
    if (status) {
      vacancies = await ctx.db
        .query('vacancies')
        .withIndex('by_org_status', (q) =>
          q
            .eq('organizationId', organizationId)
            .eq('status', status as 'draft' | 'open' | 'paused' | 'closed'),
        )
        .order('desc')
        .collect();
    } else {
      vacancies = await ctx.db
        .query('vacancies')
        .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
        .order('desc')
        .collect();
    }

    const enriched = await Promise.all(
      vacancies.map(async (vac) => {
        const apps = await ctx.db
          .query('applications')
          .withIndex('by_vacancy', (q) => q.eq('vacancyId', vac._id))
          .collect();
        const manager = await ctx.db.get(vac.hiringManagerId);
        return {
          ...vac,
          managerName: manager?.name ?? 'Unknown',
          candidateCount: apps.length,
          stageCounts: {
            applied: apps.filter((a) => a.stage === 'applied').length,
            screening: apps.filter((a) => a.stage === 'screening').length,
            interview: apps.filter((a) => a.stage === 'interview').length,
            offer: apps.filter((a) => a.stage === 'offer').length,
            hired: apps.filter((a) => a.stage === 'hired').length,
            rejected: apps.filter((a) => a.stage === 'rejected').length,
          },
        };
      }),
    );

    return enriched;
  },
});

export const getVacancy = query({
  args: { vacancyId: v.id('vacancies') },
  handler: async (ctx, { vacancyId }) => {
    const vac = await ctx.db.get(vacancyId);
    if (!vac) return null;
    const manager = await ctx.db.get(vac.hiringManagerId);
    return { ...vac, managerName: manager?.name ?? 'Unknown' };
  },
});

export const listCandidatesByVacancy = query({
  args: {
    vacancyId: v.id('vacancies'),
    stage: v.optional(v.string()),
  },
  handler: async (ctx, { vacancyId, stage }) => {
    let apps;
    if (stage) {
      apps = await ctx.db
        .query('applications')
        .withIndex('by_vacancy_stage', (q) =>
          q
            .eq('vacancyId', vacancyId)
            .eq(
              'stage',
              stage as 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected',
            ),
        )
        .collect();
    } else {
      apps = await ctx.db
        .query('applications')
        .withIndex('by_vacancy', (q) => q.eq('vacancyId', vacancyId))
        .collect();
    }

    const enriched = await Promise.all(
      apps.map(async (app) => {
        const profile = await ctx.db.get(app.candidateId);
        const scorecards = await ctx.db
          .query('interviewScorecards')
          .withIndex('by_application', (q) => q.eq('applicationId', app._id))
          .collect();
        const avgScore =
          scorecards.length > 0
            ? Math.round(
                (scorecards.reduce((s, sc) => s + sc.overallScore, 0) / scorecards.length) * 10,
              ) / 10
            : null;
        return {
          ...app,
          candidate: profile,
          scorecardsCount: scorecards.length,
          avgScore,
        };
      }),
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCandidate = query({
  args: { applicationId: v.id('applications') },
  handler: async (ctx, { applicationId }) => {
    const app = await ctx.db.get(applicationId);
    if (!app) return null;

    const profile = await ctx.db.get(app.candidateId);
    const vacancy = await ctx.db.get(app.vacancyId);

    const interviews = await ctx.db
      .query('interviews')
      .withIndex('by_application', (q) => q.eq('applicationId', applicationId))
      .collect();

    const enrichedInterviews = await Promise.all(
      interviews.map(async (iv) => {
        const interviewer = await ctx.db.get(iv.interviewerId);
        return { ...iv, interviewerName: interviewer?.name ?? 'Unknown' };
      }),
    );

    const scorecards = await ctx.db
      .query('interviewScorecards')
      .withIndex('by_application', (q) => q.eq('applicationId', applicationId))
      .collect();

    const enrichedScorecards = await Promise.all(
      scorecards.map(async (sc) => {
        const interviewer = await ctx.db.get(sc.interviewerId);
        return { ...sc, interviewerName: interviewer?.name ?? 'Unknown' };
      }),
    );

    const events = await ctx.db
      .query('applicationEvents')
      .withIndex('by_application', (q) => q.eq('applicationId', applicationId))
      .collect();

    const enrichedEvents = await Promise.all(
      events.map(async (ev) => {
        const user = await ctx.db.get(ev.changedBy);
        return { ...ev, changedByName: user?.name ?? 'Unknown' };
      }),
    );

    return {
      ...app,
      candidate: profile,
      vacancy,
      interviews: enrichedInterviews.sort((a, b) => b.scheduledAt - a.scheduledAt),
      scorecards: enrichedScorecards.sort((a, b) => b.createdAt - a.createdAt),
      events: enrichedEvents.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const getMyInterviews = query({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
  },
  handler: async (ctx, { organizationId, userId }) => {
    const interviews = await ctx.db
      .query('interviews')
      .withIndex('by_interviewer', (q) => q.eq('interviewerId', userId))
      .collect();

    const upcoming = interviews.filter(
      (iv) =>
        iv.organizationId === organizationId &&
        iv.status === 'scheduled' &&
        iv.scheduledAt > Date.now(),
    );

    const enriched = await Promise.all(
      upcoming.map(async (iv) => {
        const app = await ctx.db.get(iv.applicationId);
        const profile = app ? await ctx.db.get(app.candidateId) : null;
        const vacancy = app ? await ctx.db.get(app.vacancyId) : null;
        return {
          ...iv,
          candidateName: profile?.name ?? 'Unknown',
          vacancyTitle: vacancy?.title ?? 'Unknown',
        };
      }),
    );

    return enriched.sort((a, b) => a.scheduledAt - b.scheduledAt);
  },
});

export const getPipelineStats = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    const openVacancies = await ctx.db
      .query('vacancies')
      .withIndex('by_org_status', (q) =>
        q.eq('organizationId', organizationId).eq('status', 'open'),
      )
      .collect();

    const allApps = await ctx.db
      .query('applications')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();

    return {
      openVacancies: openVacancies.length,
      totalCandidates: allApps.length,
      pipeline: {
        applied: allApps.filter((a) => a.stage === 'applied').length,
        screening: allApps.filter((a) => a.stage === 'screening').length,
        interview: allApps.filter((a) => a.stage === 'interview').length,
        offer: allApps.filter((a) => a.stage === 'offer').length,
        hired: allApps.filter((a) => a.stage === 'hired').length,
        rejected: allApps.filter((a) => a.stage === 'rejected').length,
      },
    };
  },
});

// ============ MUTATIONS ============

export const createVacancy = mutation({
  args: {
    organizationId: v.id('organizations'),
    title: v.string(),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    employmentType: v.union(
      v.literal('full_time'),
      v.literal('part_time'),
      v.literal('contract'),
      v.literal('internship'),
    ),
    description: v.string(),
    requirements: v.optional(v.string()),
    salary: v.optional(v.object({ min: v.number(), max: v.number(), currency: v.string() })),
    hiringManagerId: v.id('users'),
    createdBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('vacancies', {
      ...args,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateVacancy = mutation({
  args: {
    vacancyId: v.id('vacancies'),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    requirements: v.optional(v.string()),
    employmentType: v.optional(
      v.union(
        v.literal('full_time'),
        v.literal('part_time'),
        v.literal('contract'),
        v.literal('internship'),
      ),
    ),
    salary: v.optional(v.object({ min: v.number(), max: v.number(), currency: v.string() })),
    hiringManagerId: v.optional(v.id('users')),
    status: v.optional(
      v.union(v.literal('draft'), v.literal('open'), v.literal('paused'), v.literal('closed')),
    ),
  },
  handler: async (ctx, { vacancyId, ...updates }) => {
    const vac = await ctx.db.get(vacancyId);
    if (!vac) throw new Error('Vacancy not found');

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.department !== undefined) patch.department = updates.department;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.requirements !== undefined) patch.requirements = updates.requirements;
    if (updates.employmentType !== undefined) patch.employmentType = updates.employmentType;
    if (updates.salary !== undefined) patch.salary = updates.salary;
    if (updates.hiringManagerId !== undefined) patch.hiringManagerId = updates.hiringManagerId;
    if (updates.status !== undefined) {
      patch.status = updates.status;
      if (updates.status === 'closed') patch.closedAt = Date.now();
    }

    await ctx.db.patch(vacancyId, patch);
  },
});

export const deleteVacancy = mutation({
  args: { vacancyId: v.id('vacancies') },
  handler: async (ctx, { vacancyId }) => {
    const vac = await ctx.db.get(vacancyId);
    if (!vac) throw new Error('Vacancy not found');

    // Delete all related applications and events
    const applications = await ctx.db
      .query('applications')
      .withIndex('by_vacancy', (q) => q.eq('vacancyId', vacancyId))
      .collect();

    for (const app of applications) {
      // Delete application events
      const events = await ctx.db
        .query('applicationEvents')
        .filter((q) => q.eq(q.field('applicationId'), app._id))
        .collect();
      for (const ev of events) {
        await ctx.db.delete(ev._id);
      }
      await ctx.db.delete(app._id);
    }

    // Delete interviews for this vacancy
    const interviews = await ctx.db
      .query('interviews')
      .filter((q) => q.eq(q.field('vacancyId'), vacancyId))
      .collect();
    for (const interview of interviews) {
      await ctx.db.delete(interview._id);
    }

    await ctx.db.delete(vacancyId);
  },
});

export const deleteCandidate = mutation({
  args: { applicationId: v.id('applications') },
  handler: async (ctx, { applicationId }) => {
    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error('Application not found');

    // Delete application events
    const events = await ctx.db
      .query('applicationEvents')
      .filter((q) => q.eq(q.field('applicationId'), applicationId))
      .collect();
    for (const ev of events) {
      await ctx.db.delete(ev._id);
    }

    // Delete interviews for this application
    const interviews = await ctx.db
      .query('interviews')
      .filter((q) => q.eq(q.field('applicationId'), applicationId))
      .collect();
    for (const interview of interviews) {
      await ctx.db.delete(interview._id);
    }

    // Delete the application
    await ctx.db.delete(applicationId);

    // Check if candidate has other applications — if not, delete profile too
    const otherApps = await ctx.db
      .query('applications')
      .filter((q) => q.eq(q.field('candidateId'), app.candidateId))
      .first();

    if (!otherApps) {
      await ctx.db.delete(app.candidateId);
    }
  },
});

export const addCandidate = mutation({
  args: {
    organizationId: v.id('organizations'),
    vacancyId: v.id('vacancies'),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    resumeText: v.optional(v.string()),
    source: v.union(
      v.literal('manual'),
      v.literal('referral'),
      v.literal('career_page'),
      v.literal('linkedin'),
      v.literal('other'),
    ),
    referredBy: v.optional(v.id('users')),
    createdBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const {
      vacancyId,
      name,
      email,
      phone,
      resumeText,
      source,
      referredBy,
      organizationId,
      createdBy,
    } = args;

    // Check if candidate profile exists by email
    const existing = await ctx.db
      .query('candidateProfiles')
      .withIndex('by_org_email', (q) => q.eq('organizationId', organizationId).eq('email', email))
      .first();

    const now = Date.now();
    let candidateId;

    if (existing) {
      candidateId = existing._id;
    } else {
      candidateId = await ctx.db.insert('candidateProfiles', {
        organizationId,
        name,
        email,
        phone,
        resumeText,
        source,
        referredBy,
        createdBy,
        createdAt: now,
      });
    }

    // Create application
    const applicationId = await ctx.db.insert('applications', {
      organizationId,
      candidateId,
      vacancyId,
      stage: 'applied',
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Record stage event
    await ctx.db.insert('applicationEvents', {
      applicationId,
      organizationId,
      toStage: 'applied',
      changedBy: createdBy,
      createdAt: now,
    });

    // 🔔 Notify org admins about new candidate
    const orgAdmins = await ctx.db
      .query('users')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .filter((q) => q.or(q.eq(q.field('role'), 'admin'), q.eq(q.field('role'), 'superadmin')))
      .collect();

    const vacancy = await ctx.db.get(vacancyId);
    for (const admin of orgAdmins) {
      if (admin._id === createdBy) continue; // don't notify self
      await ctx.db.insert('notifications', {
        organizationId,
        userId: admin._id,
        type: 'system',
        title: '📩 New Candidate Added',
        message: `${name} was added to "${vacancy?.title || 'vacancy'}" (${source})`,
        isRead: false,
        relatedId: applicationId,
        createdAt: now,
      });
    }

    return applicationId;
  },
});

export const moveCandidate = mutation({
  args: {
    applicationId: v.id('applications'),
    newStage: v.union(
      v.literal('applied'),
      v.literal('screening'),
      v.literal('interview'),
      v.literal('offer'),
      v.literal('hired'),
      v.literal('rejected'),
    ),
    userId: v.id('users'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, newStage, userId, reason }) => {
    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error('Application not found');

    const oldStage = app.stage;
    if (oldStage === newStage) return;

    const now = Date.now();
    const patch: Record<string, unknown> = { stage: newStage, updatedAt: now };
    if (newStage === 'rejected' && reason) patch.rejectionReason = reason;

    await ctx.db.patch(applicationId, patch);

    // Record event
    await ctx.db.insert('applicationEvents', {
      applicationId,
      organizationId: app.organizationId,
      fromStage: oldStage,
      toStage: newStage,
      changedBy: userId,
      reason,
      createdAt: now,
    });
  },
});

export const rejectCandidate = mutation({
  args: {
    applicationId: v.id('applications'),
    userId: v.id('users'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, userId, reason }) => {
    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error('Application not found');

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      stage: 'rejected',
      rejectionReason: reason,
      updatedAt: now,
    });

    await ctx.db.insert('applicationEvents', {
      applicationId,
      organizationId: app.organizationId,
      fromStage: app.stage,
      toStage: 'rejected',
      changedBy: userId,
      reason,
      createdAt: now,
    });
  },
});

export const scheduleInterview = mutation({
  args: {
    applicationId: v.id('applications'),
    organizationId: v.id('organizations'),
    interviewerId: v.id('users'),
    scheduledAt: v.number(),
    duration: v.number(),
    type: v.union(
      v.literal('phone'),
      v.literal('video'),
      v.literal('onsite'),
      v.literal('technical'),
      v.literal('hr'),
    ),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('interviews', {
      ...args,
      status: 'scheduled',
      createdAt: Date.now(),
    });
  },
});

export const updateInterviewStatus = mutation({
  args: {
    interviewId: v.id('interviews'),
    status: v.union(v.literal('completed'), v.literal('cancelled'), v.literal('no_show')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { interviewId, status, notes }) => {
    const patch: Record<string, unknown> = { status };
    if (notes !== undefined) patch.notes = notes;
    await ctx.db.patch(interviewId, patch);
  },
});

export const submitScorecard = mutation({
  args: {
    applicationId: v.id('applications'),
    organizationId: v.id('organizations'),
    interviewId: v.optional(v.id('interviews')),
    interviewerId: v.id('users'),
    ratings: v.array(
      v.object({
        criterion: v.string(),
        score: v.number(),
        comment: v.optional(v.string()),
      }),
    ),
    overallScore: v.number(),
    recommendation: v.union(
      v.literal('strong_yes'),
      v.literal('yes'),
      v.literal('neutral'),
      v.literal('no'),
      v.literal('strong_no'),
    ),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Mark interview as completed if linked
    if (args.interviewId) {
      await ctx.db.patch(args.interviewId, { status: 'completed' });
    }

    return await ctx.db.insert('interviewScorecards', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateCandidateNotes = mutation({
  args: {
    applicationId: v.id('applications'),
    notes: v.string(),
  },
  handler: async (ctx, { applicationId, notes }) => {
    await ctx.db.patch(applicationId, { notes, updatedAt: Date.now() });
  },
});
