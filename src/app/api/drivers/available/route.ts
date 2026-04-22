import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const SUPABASE_URL = supabaseUrl as string;
const SUPABASE_SERVICE_KEY = supabaseServiceKey as string;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const organizationId = searchParams.get('organizationId');
    const driverId = searchParams.get('driverId');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const excludeDriverId = searchParams.get('excludeDriverId');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === 'get-available-drivers') {
      if (!organizationId) {
        return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
      }

      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          *,
          users!drivers_user_id_fkey (
            id,
            name,
            avatar_url,
            department,
            position
          ),
          vehicles!vehicles_driver_id_fkey (
            id,
            model,
            plate_number,
            capacity,
            color,
            year
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('is_available', true);

      if (error) {
        throw error;
      }

      const mapped = (drivers || []).map((driver: any) => ({
        id: driver.id,
        userName: driver.users?.name,
        userAvatar: driver.users?.avatar_url,
        userPosition: driver.users?.position,
        vehicleInfo: driver.vehicles
          ? {
              model: driver.vehicles.model,
              plateNumber: driver.vehicles.plate_number,
              capacity: driver.vehicles.capacity,
              color: driver.vehicles.color,
              year: driver.vehicles.year,
            }
          : null,
        rating: driver.rating || 0,
        totalTrips: driver.total_trips || 0,
        isOnShift: driver.is_on_shift,
        isAvailable: driver.is_available,
        isActive: driver.is_active,
        organizationId: driver.organization_id,
      }));

      return NextResponse.json({ data: mapped });
    }

    if (action === 'is-driver-on-leave') {
      if (!driverId || !startTime || !endTime) {
        return NextResponse.json(
          { error: 'driverId, startTime, and endTime required' },
          { status: 400 },
        );
      }

      const startTimestamp = parseInt(startTime);
      const endTimestamp = parseInt(endTime);

      const startDate = new Date(startTimestamp).toISOString().split('T')[0];
      const endDate = new Date(endTimestamp).toISOString().split('T')[0];

      const { data: leave, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('driverid', driverId)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        data: leave
          ? {
              onLeave: true,
              leave: {
                id: leave.id,
                type: leave.leave_type,
                startDate: leave.start_date,
                endDate: leave.end_date,
                reason: leave.reason,
              },
            }
          : { onLeave: false, leave: null },
      });
    }

    if (action === 'get-alternative-drivers') {
      if (!organizationId || !startTime || !endTime || !excludeDriverId) {
        return NextResponse.json(
          { error: 'organizationId, startTime, endTime, and excludeDriverId required' },
          { status: 400 },
        );
      }

      const startTimestamp = parseInt(startTime);
      const endTimestamp = parseInt(endTime);

      const startDate = new Date(startTimestamp).toISOString().split('T')[0];
      const endDate = new Date(endTimestamp).toISOString().split('T')[0];

      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          *,
          users!drivers_user_id_fkey (
            id,
            name,
            avatar_url,
            department,
            position
          ),
          vehicles!vehicles_driver_id_fkey (
            id,
            model,
            plate_number,
            capacity,
            color,
            year
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('is_available', true)
        .neq('id', excludeDriverId);

      if (error) {
        throw error;
      }

      // Batch fetch all leave requests for the date range instead of N+1 queries
      const driverIds = (drivers || []).map((d: any) => d.id);
      const { data: leaves } = driverIds.length > 0
        ? await supabase
            .from('leave_requests')
            .select('driverid, id, start_date, end_date, status')
            .in('driverid', driverIds)
            .eq('status', 'approved')
            .lte('start_date', endDate)
            .gte('end_date', startDate)
        : { data: [] };

      // Create a set of driver IDs that are on leave
      const driversOnLeave = new Set((leaves || []).map((l: any) => l.driverid));

      // Filter out drivers who are not on leave
      const availableDrivers = (drivers || [])
        .filter((driver: any) => !driversOnLeave.has(driver.id))
        .map((driver: any) => ({
          id: driver.id,
          userName: driver.users?.name,
          userAvatar: driver.users?.avatar_url,
          userPosition: driver.users?.position,
          vehicleInfo: driver.vehicles
            ? {
                model: driver.vehicles.model,
                plateNumber: driver.vehicles.plate_number,
                capacity: driver.vehicles.capacity,
                color: driver.vehicles.color,
                year: driver.vehicles.year,
              }
            : null,
          rating: driver.rating || 0,
          totalTrips: driver.total_trips || 0,
          isOnShift: driver.is_on_shift,
          isAvailable: driver.is_available,
          isActive: driver.is_active,
          organizationId: driver.organization_id,
        }));

      return NextResponse.json({ data: availableDrivers });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Drivers API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const body = await req.json();
    const requesterId = auth.user.id;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === 'request-driver') {
      const {
        organizationId,
        driverId,
        startTime,
        endTime,
        tripInfo,
      } = body;

      if (!organizationId || !driverId || !startTime || !endTime) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 },
        );
      }

      const { data: request, error } = await supabase
        .from('driver_requests')
        .insert({
          organization_id: organizationId,
          requester_id: requesterId,
          driver_id: driverId,
          start_time: startTime,
          end_time: endTime,
          trip_info: tripInfo,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        data: {
          id: request.id,
          organization_id: request.organization_id,
          requesterId: request.requester_id,
          driverId: request.driver_id,
          startTime: request.start_time,
          endTime: request.end_time,
          tripInfo: request.trip_info,
          status: request.status,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Drivers API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
