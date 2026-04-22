import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/lib/supabase/database.types';

type DriverRequest = Database['public']['Tables']['driver_requests']['Row'];
type DriverSchedule = Database['public']['Tables']['driver_schedules']['Row'];
type Driver = Database['public']['Tables']['drivers']['Row'];

function mapDriverRequest(r: DriverRequest) {
  return {
    ...r,
    id: r.id,
    organizationId: r.organization_id,
    requesterId: r.requesterid,
    driverId: r.driverid,
    startTime: r.start_time,
    endTime: r.end_time,
    tripFrom: r.trip_from,
    tripTo: r.trip_to,
    tripPurpose: r.trip_purpose,
    passengerCount: r.passenger_count,
    tripNotes: r.trip_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapDriverSchedule(s: DriverSchedule) {
  return {
    ...s,
    id: s.id,
    driverId: s.driverid,
    startTime: s.start_time,
    endTime: s.end_time,
    scheduleType: s.schedule_type,
    tripFrom: s.trip_from,
    tripTo: s.trip_to,
    tripPurpose: s.trip_purpose,
    passengerCount: s.passenger_count,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapDriver(d: Driver) {
  return {
    ...d,
    id: d.id,
    organizationId: d.organization_id,
    userId: d.userid,
    vehicleModel: d.vehicle_model,
    vehiclePlateNumber: d.vehicle_plate_number,
    vehicleCapacity: d.vehicle_capacity,
    vehicleColor: d.vehicle_color,
    vehicleYear: d.vehicle_year,
    isAvailable: d.is_available,
    isOnShift: d.is_on_shift,
    workingHoursStart: d.working_hours_start,
    workingHoursEnd: d.working_hours_end,
    workingDays: d.working_days,
    maxTripsPerDay: d.max_trips_per_day,
    currentTripsToday: d.current_trips_today,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseService = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (type === 'available-drivers') {
      const organizationId = searchParams.get('organizationId');

      if (!organizationId) {
        return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
      }

      const { data: drivers, error } = await supabaseService
        .from('drivers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_available', true);

      if (error) {
        console.error('Available drivers query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const enriched = (drivers || []).map(mapDriver);

      return NextResponse.json(enriched);
    }

    if (type === 'driver-schedules') {
      const driverId = searchParams.get('driverId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (!driverId) {
        return NextResponse.json({ error: 'driverId required' }, { status: 400 });
      }

      let query = supabaseService
        .from('driver_schedules')
        .select('*')
        .eq('driverid', driverId)
        .order('start_time', { ascending: true });

      if (startDate) {
        const startTs = new Date(startDate).getTime();
        query = query.gte('start_time', startTs);
      }
      if (endDate) {
        const endTs = new Date(endDate).getTime();
        query = query.lte('start_time', endTs);
      }

      const { data: schedules, error } = await query;

      if (error) {
        console.error('Driver schedules query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (schedules || []).map(mapDriverSchedule);

      return NextResponse.json(mapped);
    }

    if (type === 'driver-requests') {
      const organizationId = searchParams.get('organizationId');
      const userId = searchParams.get('userId');
      const status = searchParams.get('status');

      if (!organizationId && !userId) {
        return NextResponse.json({ error: 'organizationId or userId required' }, { status: 400 });
      }

      let query = supabaseService
        .from('driver_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      if (userId) {
        query = query.eq('requesterid', userId);
      }
      if (status) {
        const validStatuses = ['pending', 'approved', 'declined', 'cancelled', 'completed'] as const;
        if (validStatuses.includes(status as typeof validStatuses[number])) {
          query = query.eq('status', status as typeof validStatuses[number]);
        }
      }

      const { data: requests, error } = await query;

      if (error) {
        console.error('Driver requests query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (requests || []).map(mapDriverRequest);

      return NextResponse.json(mapped);
    }

    if (type === 'recurring-trips') {
      const organizationId = searchParams.get('organizationId');

      if (!organizationId) {
        return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
      }

      const { data: trips, error } = await supabaseService
        .from('recurring_trips')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Recurring trips query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (trips || []).map((t: any) => ({
        ...t,
        id: t.id,
        organizationId: t.organization_id,
        userId: t.userid,
        driverId: t.driverid,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        tripFrom: t.trip_from,
        tripTo: t.trip_to,
        tripPurpose: t.trip_purpose,
        schedule: t.schedule,
      }));

      return NextResponse.json(mapped);
    }

    if (type === 'driver-shifts') {
      const organizationId = searchParams.get('organizationId');
      const driverId = searchParams.get('driverId');

      let query = supabaseService
        .from('driver_shifts')
        .select('*')
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      if (driverId) {
        query = query.eq('driverid', driverId);
      }

      const { data: shifts, error } = await query;

      if (error) {
        console.error('Driver shifts query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (shifts || []).map((s: any) => ({
        ...s,
        id: s.id,
        organizationId: s.organization_id,
        driverId: s.driverid,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));

      return NextResponse.json(mapped);
    }

    if (type === 'driver-favorites') {
      const userId = searchParams.get('userId');

      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }

      const { data: favorites, error } = await supabaseService
        .from('passenger_favorites')
        .select('*')
        .eq('passengerid', userId);

      if (error) {
        console.error('Passenger favorites query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapped = (favorites || []).map((f: any) => ({
        ...f,
        id: f.id,
        passengerId: f.passengerid,
        driverId: f.driverid,
      }));

      return NextResponse.json(mapped);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Drivers API GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseService = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type } = body;

    if (type === 'create-request') {
      const {
        organizationId,
        driverId,
        startTime,
        endTime,
        tripFrom,
        tripTo,
        tripPurpose,
        passengerCount,
        tripNotes,
      } = body;

      if (!organizationId || !driverId || !startTime || !endTime || !tripFrom || !tripTo) {
        return NextResponse.json(
          { error: 'organizationId, driverId, startTime, endTime, tripFrom, tripTo are required' },
          { status: 400 }
        );
      }

      const startTs = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
      const endTs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

      const { data: request, error } = await supabaseService
        .from('driver_requests')
        .insert({
          organization_id: organizationId,
          driverid: driverId,
          requesterid: user.id,
          start_time: startTs,
          end_time: endTs,
          trip_from: tripFrom,
          trip_to: tripTo,
          trip_purpose: tripPurpose || '',
          passenger_count: passengerCount || 1,
          trip_notes: tripNotes || null,
          status: 'pending',
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Create driver request error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!request) {
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
      }

      return NextResponse.json(mapDriverRequest(request));
    }

    if (type === 'update-request-status') {
      const { requestId, status } = body;

      if (!requestId || !status) {
        return NextResponse.json({ error: 'requestId and status are required' }, { status: 400 });
      }

      const { data: request, error } = await supabaseService
        .from('driver_requests')
        .update({ status, updated_at: Date.now() })
        .eq('id', requestId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Update request status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!request) {
        return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
      }

      return NextResponse.json(mapDriverRequest(request));
    }

    if (type === 'create-schedule') {
      const {
        driverId,
        scheduleType,
        startTime,
        endTime,
        tripFrom,
        tripTo,
        tripPurpose,
        passengerCount,
        notes,
      } = body;

      if (!driverId || !startTime || !endTime || !scheduleType) {
        return NextResponse.json(
          { error: 'driverId, startTime, endTime, scheduleType are required' },
          { status: 400 }
        );
      }

      const startTs = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
      const endTs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

      const { data: schedule, error } = await supabaseService
        .from('driver_schedules')
        .insert({
          driverid: driverId,
          schedule_type: scheduleType,
          start_time: startTs,
          end_time: endTs,
          trip_from: tripFrom || null,
          trip_to: tripTo || null,
          trip_purpose: tripPurpose || null,
          passenger_count: passengerCount || null,
          notes: notes || null,
          status: 'scheduled',
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Create schedule error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!schedule) {
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
      }

      return NextResponse.json(mapDriverSchedule(schedule));
    }

    if (type === 'update-schedule-status') {
      const { scheduleId, status } = body;

      if (!scheduleId || !status) {
        return NextResponse.json({ error: 'scheduleId and status are required' }, { status: 400 });
      }

      const { data: schedule, error } = await supabaseService
        .from('driver_schedules')
        .update({ status, updated_at: Date.now() })
        .eq('id', scheduleId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Update schedule status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!schedule) {
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
      }

      return NextResponse.json(mapDriverSchedule(schedule));
    }

    if (type === 'submit-rating') {
      const {
        scheduleId,
        requestId,
        passengerId,
        driverId,
        organizationId,
        rating,
        comment,
      } = body;

      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
      }

      const { data: ratingRecord, error } = await supabaseService
        .from('passenger_ratings')
        .insert({
          scheduleid: scheduleId || null,
          requestid: requestId || null,
          passengerid: passengerId,
          driverid: driverId,
          organization_id: organizationId || null,
          rating,
          comment: comment || null,
          created_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Submit rating error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!ratingRecord) {
        return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 });
      }

      return NextResponse.json({
        ...ratingRecord,
        id: ratingRecord.id,
        scheduleId: ratingRecord.scheduleid,
        requestId: ratingRecord.requestid,
        passengerId: ratingRecord.passengerid,
        driverId: ratingRecord.driverid,
        organizationId: ratingRecord.organization_id,
        createdAt: ratingRecord.created_at,
      });
    }

    if (type === 'create-recurring-trip') {
      const {
        organizationId,
        driverId,
        tripFrom,
        tripTo,
        tripPurpose,
        schedule,
      } = body;

      if (!organizationId || !driverId || !tripFrom || !tripTo || !schedule) {
        return NextResponse.json(
          { error: 'organizationId, driverId, tripFrom, tripTo, schedule are required' },
          { status: 400 }
        );
      }

      const { data: trip, error } = await supabaseService
        .from('recurring_trips')
        .insert({
          organization_id: organizationId,
          driverid: driverId,
          userid: user.id,
          trip_from: tripFrom,
          trip_to: tripTo,
          trip_purpose: tripPurpose || '',
          schedule,
          is_active: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Create recurring trip error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!trip) {
        return NextResponse.json({ error: 'Failed to create recurring trip' }, { status: 500 });
      }

      return NextResponse.json({
        ...trip,
        id: trip.id,
        organizationId: trip.organization_id,
        userId: trip.userid,
        driverId: trip.driverid,
        isActive: trip.is_active,
        createdAt: trip.created_at,
        updatedAt: trip.updated_at,
      });
    }

    if (type === 'create-shift') {
      const {
        organizationId,
        driverId,
        startTime,
        end_time: endTime,
      } = body;

      if (!organizationId || !driverId || !startTime) {
        return NextResponse.json(
          { error: 'organizationId, driverId, startTime are required' },
          { status: 400 }
        );
      }

      const startTs = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
      const endTs = endTime ? (typeof endTime === 'number' ? endTime : new Date(endTime).getTime()) : null;

      const { data: shift, error } = await supabaseService
        .from('driver_shifts')
        .insert({
          organization_id: organizationId,
          driverid: driverId,
          start_time: startTs,
          end_time: endTs,
          status: 'active',
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Create shift error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!shift) {
        return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
      }

      return NextResponse.json({
        ...shift,
        id: shift.id,
        organizationId: shift.organization_id,
        driverId: shift.driverid,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
        createdAt: shift.created_at,
        updatedAt: shift.updated_at,
      });
    }

    if (type === 'end-shift') {
      const { shiftId, endTime } = body;

      if (!shiftId) {
        return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
      }

      const endTs = endTime ? (typeof endTime === 'number' ? endTime : new Date(endTime).getTime()) : Date.now();

      const { data: shift, error } = await supabaseService
        .from('driver_shifts')
        .update({
          end_time: endTs,
          status: 'completed',
          updated_at: Date.now(),
        })
        .eq('id', shiftId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('End shift error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!shift) {
        return NextResponse.json({ error: 'Failed to end shift' }, { status: 500 });
      }

      return NextResponse.json({
        ...shift,
        id: shift.id,
        organizationId: shift.organization_id,
        driverId: shift.driverid,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
        createdAt: shift.created_at,
        updatedAt: shift.updated_at,
      });
    }

    if (type === 'add-favorite') {
      const { organizationId, userId, driverId } = body;

      if (!userId || !driverId) {
        return NextResponse.json({ error: 'userId and driverId are required' }, { status: 400 });
      }

      const { data: existing, error: existingError } = await supabaseService
        .from('passenger_favorites')
        .select('id')
        .eq('passengerid', userId)
        .eq('driverid', driverId)
        .maybeSingle();

      if (existingError) {
        console.error('Check favorite error:', existingError);
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      if (existing) {
        return NextResponse.json({ message: 'Already in favorites', id: existing.id });
      }

      const { data: favorite, error } = await supabaseService
        .from('passenger_favorites')
        .insert({
          passengerid: userId,
          driverid: driverId,
          organization_id: organizationId || null,
          created_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Add favorite error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!favorite) {
        return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
      }

      return NextResponse.json({
        ...favorite,
        id: favorite.id,
        passengerId: favorite.passengerid,
        driverId: favorite.driverid,
        createdAt: favorite.created_at,
      });
    }

    if (type === 'remove-favorite') {
      const { userId, driverId } = body;

      if (!userId || !driverId) {
        return NextResponse.json({ error: 'userId and driverId are required' }, { status: 400 });
      }

      const { error } = await supabaseService
        .from('passenger_favorites')
        .delete()
        .eq('passengerid', userId)
        .eq('driverid', driverId);

      if (error) {
        console.error('Remove favorite error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'register-driver') {
      const { userId, organizationId, vehicleInfo, workingHours, maxTripsPerDay, adminId } = body;

      if (!userId || !organizationId) {
        return NextResponse.json({ error: 'userId and organizationId are required' }, { status: 400 });
      }

      const { data: driver, error: driverError } = await supabaseService
        .from('drivers')
        .insert({
          userid: userId,
          organization_id: organizationId,
          is_available: true,
          is_on_shift: false,
          vehicle_model: vehicleInfo?.model || '',
          vehicle_plate_number: vehicleInfo?.plateNumber || '',
          vehicle_capacity: vehicleInfo?.capacity || 0,
          vehicle_color: vehicleInfo?.color || null,
          vehicle_year: vehicleInfo?.year || null,
          max_trips_per_day: maxTripsPerDay || 3,
          working_hours_start: workingHours?.start || '09:00',
          working_hours_end: workingHours?.end || '17:00',
          working_days: [1, 2, 3, 4, 5],
          current_trips_today: 0,
          rating: 0,
          total_trips: 0,
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (driverError) {
        console.error('Register driver error:', driverError);
        return NextResponse.json({ error: driverError.message }, { status: 500 });
      }

      if (!driver) {
        return NextResponse.json({ error: 'Failed to register driver' }, { status: 500 });
      }

      return NextResponse.json(mapDriver(driver));
    }

    if (type === 'reassign-request') {
      const { requestId, newDriverId } = body;

      if (!requestId || !newDriverId) {
        return NextResponse.json({ error: 'requestId and newDriverId are required' }, { status: 400 });
      }

      const { data: request, error } = await supabaseService
        .from('driver_requests')
        .update({
          driverid: newDriverId,
          status: 'pending',
          updated_at: Date.now(),
        })
        .eq('id', requestId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Reassign request error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!request) {
        return NextResponse.json({ error: 'Failed to reassign request' }, { status: 500 });
      }

      return NextResponse.json(mapDriverRequest(request));
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Drivers API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
