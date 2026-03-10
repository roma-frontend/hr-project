import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { userId, organizationId, driverId, startTime, endTime, tripInfo } = await req.json();

    console.log('[book-driver] Received request:', { userId, organizationId, driverId, startTime, endTime, tripInfo });

    if (!userId || !organizationId || !driverId || !startTime || !endTime || !tripInfo) {
      console.error('[book-driver] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate IDs are proper Convex IDs
    if (!userId || !userId.startsWith('jn')) {
      console.error('[book-driver] Invalid userId:', userId);
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      );
    }
    if (!organizationId || (!organizationId.startsWith('jn') && !organizationId.startsWith('n5'))) {
      console.error('[book-driver] Invalid organizationId:', organizationId);
      return NextResponse.json(
        { error: 'Invalid organizationId format' },
        { status: 400 }
      );
    }
    if (!driverId || !driverId.startsWith('jn')) {
      console.error('[book-driver] Invalid driverId:', driverId);
      return NextResponse.json(
        { error: `Invalid driverId format. Must start with "jn", got: "${driverId}"` },
        { status: 400 }
      );
    }

    // Create driver request directly
    const requestId = await convex.mutation(api.drivers.requestDriver, {
      organizationId: organizationId as Id<"organizations">,
      requesterId: userId as Id<"users">,
      driverId: driverId as Id<"drivers">,
      startTime,
      endTime,
      tripInfo: {
        from: tripInfo.from || 'Not specified',
        to: tripInfo.to || 'Not specified',
        purpose: tripInfo.purpose || 'AI Booking',
        passengerCount: tripInfo.passengerCount || 1,
        notes: tripInfo.notes || 'Booked via AI Assistant',
      },
    });

    console.log('[book-driver] Request created:', requestId);

    return NextResponse.json({
      message: 'Driver request submitted successfully!',
      success: true,
      requestId,
    });
  } catch (error: any) {
    console.error('[book-driver] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to book driver' },
      { status: 500 }
    );
  }
}
