import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { name, email, company, teamSize, message, plan } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('contact_inquiries')
      .insert({
        name,
        email,
        company: company || null,
        team_size: teamSize || null,
        message,
        plan: plan || null,
        created_at: Date.now(),
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[Contact POST] Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit contact inquiry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Contact POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
