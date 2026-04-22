import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/supabase/database.types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = resolvedParams.id;

    const { data: employee } = await supabase
      .from('users')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        employeeType: employee.employee_type,
        department: employee.department,
        position: employee.position,
        phone: employee.phone,
        avatarUrl: employee.avatar_url,
        presenceStatus: employee.presence_status,
        supervisorId: employee.supervisorid,
        isActive: employee.is_active,
        isApproved: employee.is_approved,
        organizationId: employee.organization_id,
        travelAllowance: employee.travel_allowance,
        paidLeaveBalance: employee.paid_leave_balance,
        sickLeaveBalance: employee.sick_leave_balance,
        familyLeaveBalance: employee.family_leave_balance,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
      },
    });
  } catch (error) {
    console.error('[Employee API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = resolvedParams.id;
    const body = await req.json();

    const updateData: TablesUpdate<'users'> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.employeeType !== undefined) updateData.employee_type = body.employeeType;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.supervisorId !== undefined) updateData.supervisorid = body.supervisorId;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.travelAllowance !== undefined) updateData.travel_allowance = body.travelAllowance;
    if (body.paidLeaveBalance !== undefined) updateData.paid_leave_balance = body.paidLeaveBalance;
    if (body.sickLeaveBalance !== undefined) updateData.sick_leave_balance = body.sickLeaveBalance;
    if (body.familyLeaveBalance !== undefined) updateData.family_leave_balance = body.familyLeaveBalance;
    if (body.presenceStatus !== undefined) updateData.presence_status = body.presenceStatus;

    updateData.updated_at = Date.now();

    const { data: employee, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', employeeId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        employeeType: employee.employee_type,
        department: employee.department,
        position: employee.position,
        phone: employee.phone,
        avatarUrl: employee.avatar_url,
        presenceStatus: employee.presence_status,
        supervisorId: employee.supervisorid,
        isActive: employee.is_active,
        isApproved: employee.is_approved,
        organizationId: employee.organization_id,
        travelAllowance: employee.travel_allowance,
        paidLeaveBalance: employee.paid_leave_balance,
        sickLeaveBalance: employee.sick_leave_balance,
        familyLeaveBalance: employee.family_leave_balance,
        createdAt: employee.created_at,
        updatedAt: employee.updated_at,
      },
    });
  } catch (error) {
    console.error('[Employee API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
