import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');

    if (!organizationId || !organizationId.startsWith('jn')) {
      return NextResponse.json(
        { error: 'Invalid or missing organizationId' },
        { status: 400 }
      );
    }

    // Get available drivers
    const drivers = await convex.query(api.drivers.getAvailableDrivers, {
      organizationId: organizationId as Id<"organizations">,
    });

    return NextResponse.json(drivers);
  } catch (error: any) {
    console.error('Get drivers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get drivers' },
      { status: 500 }
    );
  }
}
