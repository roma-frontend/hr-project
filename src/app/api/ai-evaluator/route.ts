import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const { data: evaluation } = await supabase
      .from('ai_evaluations')
      .select('*')
      .eq('userId', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!evaluation) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        id: evaluation.id,
        userId: evaluation.userId,
        overallScore: evaluation.overall_score,
        breakdown: evaluation.breakdown,
        createdAt: evaluation.createdAt,
      },
    });
  } catch (error) {
    console.error('[AI Evaluator API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { employeeId, overallScore, breakdown } = body;

    if (!employeeId || !overallScore) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: evaluation, error } = await supabase
      .from('ai_evaluations')
      .insert({
        userId: employeeId,
        overall_score: overallScore,
        breakdown: breakdown || {},
        createdAt: Date.now(),
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: evaluation });
  } catch (error) {
    console.error('[AI Evaluator API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
