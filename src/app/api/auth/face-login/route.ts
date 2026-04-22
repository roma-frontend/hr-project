import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordFaceIdAttempt, checkFaceIdStatus } from '@/lib/supabase/face';
import { getAllFaceDescriptors, getFaceDescriptor } from '@/lib/supabase/face';
import { compareFaces, isFaceMatch } from '@/lib/faceApi';

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const faceLoginAttempts = new Map<string, number[]>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { faceDescriptor: incomingDescriptor, userId } = body;

    if (!incomingDescriptor || !userId) {
      return NextResponse.json(
        { error: 'Face descriptor and user ID are required' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const attempts = faceLoginAttempts.get(userId) || [];
    const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);

    if (recentAttempts.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    recentAttempts.push(now);
    faceLoginAttempts.set(userId, recentAttempts);

    const faceStatus = await checkFaceIdStatus(userId);

    if (faceStatus.blocked) {
      const cooldownMs = 30 * 60 * 1000;
      const timeSinceBlocked = now - (faceStatus.blockedAt || 0) * 1000;

      if (timeSinceBlocked < cooldownMs) {
        return NextResponse.json(
          { error: 'Face ID is blocked. Please use password login.' },
          { status: 403 }
        );
      }
    }

    const storedFaceData = await getFaceDescriptor(userId);

    if (!storedFaceData || !storedFaceData.face_descriptor) {
      return NextResponse.json(
        { error: 'Face not registered' },
        { status: 404 }
      );
    }

    const storedDescriptor = storedFaceData.face_descriptor as number[];
    const distance = await compareFaces(incomingDescriptor, storedDescriptor);
    const matched = isFaceMatch(distance);

    if (!matched) {
      await recordFaceIdAttempt(userId, false);

      const newStatus = await checkFaceIdStatus(userId);
      if (newStatus.blocked) {
        return NextResponse.json(
          { error: 'Face ID blocked due to too many failed attempts.' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Face not recognized. Please try again.' },
        { status: 401 }
      );
    }

    await recordFaceIdAttempt(userId, true);

    const supabase = await createClient();
    const { data: userProfile } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        employee_type,
        department,
        position,
        phone,
        avatar_url,
        presence_status,
        is_active,
        is_approved,
        organization_id,
        organizations!inner (
          id,
          name,
          slug
        )
      `)
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { data: sessionData } = await supabase.auth.signInWithPassword({
      email: userProfile.email,
      password: 'face-login-bypass',
    });

    return NextResponse.json({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        avatar: userProfile.avatar_url,
        department: userProfile.department,
        position: userProfile.position,
        employeeType: userProfile.employee_type,
        organizationId: userProfile.organization_id,
        organizationSlug: userProfile.organizations?.slug,
        organizationName: userProfile.organizations?.name,
        isApproved: userProfile.is_approved,
        phone: userProfile.phone,
        presenceStatus: userProfile.presence_status,
      },
      session: sessionData?.session,
    });
  } catch (error) {
    console.error('[face-login] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
