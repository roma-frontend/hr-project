import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

async function getAuthUser() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  return auth.user;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (authUser instanceof NextResponse) return authUser;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'get-all-tickets': {
        const { data: tickets, error } = await supabaseService
          .from('tickets')
          .select('*')
          .order('createdat', { ascending: false });

        if (error) {
          console.error('[Tickets API] get-all-tickets error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const mapped = (tickets || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          category: t.category,
          createdBy: t.createdBy,
          organization_id: t.organization_id,
          assignedTo: t.assignedTo,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));

        return NextResponse.json({ data: mapped });
      }

      case 'get-ticket-stats': {
        const { data: tickets } = await supabaseService
          .from('tickets')
          .select('status, priority');

        const open = (tickets || []).filter((t: any) => t.status === 'open').length;
        const inProgress = (tickets || []).filter((t: any) => t.status === 'in_progress').length;
        const waitingCustomer = (tickets || []).filter((t: any) => t.status === 'waiting_customer').length;
        const resolved = (tickets || []).filter((t: any) => t.status === 'resolved').length;
        const closed = (tickets || []).filter((t: any) => t.status === 'closed').length;
        const critical = (tickets || []).filter((t: any) => t.priority === 'critical').length;

        return NextResponse.json({
          data: {
            total: (tickets || []).length,
            open,
            inProgress,
            waitingCustomer,
            resolved,
            closed,
            critical,
            overdue: 0,
            avgResponseTime: 2,
          },
        });
      }

      case 'get-my-tickets': {
        const userId = searchParams.get('userId');
        const organizationId = searchParams.get('organizationId');
        
        if (!userId || !organizationId) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const { data: tickets, error } = await supabaseService
          .from('tickets')
          .select('*')
          .eq('createdBy', userId)
          .eq('organization_id', organizationId)
          .order('createdAt', { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const mapped = (tickets || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          category: t.category,
          createdBy: t.createdBy,
          organization_id: t.organization_id,
          assignedTo: t.assignedTo,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));

        return NextResponse.json({ data: mapped });
      }

      case 'get-ticket-by-id': {
        const ticketId = searchParams.get('ticketId');
        if (!ticketId) {
          return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
        }

        const { data: ticket, error } = await supabaseService
          .from('tickets')
          .select('*')
          .eq('id', ticketId)
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!ticket) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        const { data: comments } = await supabaseService
          .from('ticket_comments')
          .select('*')
          .eq('ticketId', ticketId)
          .order('createdAt', { ascending: true });

        const mapped = {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          status: ticket.status,
          category: ticket.category,
          createdBy: ticket.createdBy,
          organization_id: ticket.organization_id,
          assignedTo: ticket.assignedTo,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          comments: (comments || []).map((c: any) => ({
            id: c.id,
            message: c.content,
            isInternal: c.isInternal,
            authorId: c.userId,
            createdAt: c.createdAt,
          })),
        };

        return NextResponse.json({ data: mapped });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Tickets API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (authUser instanceof NextResponse) return authUser;

    const supabaseService = createServiceClient();
    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action');

    switch (action) {
      case 'create-ticket': {
        const { organizationId, title, description, priority, category } = body;

        if (!title || !description) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const now = Date.now();

        const { data: ticket, error } = await supabaseService
          .from('tickets')
          .insert({
            organization_id: organizationId || null,
            title,
            description,
            priority: priority || 'medium',
            status: 'open',
            category: category || 'technical',
            createdBy: authUser.id,
            createdAt: now,
            updatedAt: now,
          })
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: ticket });
      }

      case 'update-ticket-status': {
        const { ticketId, status } = body;

        if (!ticketId || !status) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: ticket, error } = await supabaseService
          .from('tickets')
          .update({ status, updatedAt: Date.now() })
          .eq('id', ticketId)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: ticket });
      }

      case 'assign-ticket': {
        const { ticketId, assignedTo } = body;

        if (!ticketId || !assignedTo) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: ticket, error } = await supabaseService
          .from('tickets')
          .update({ assignedTo, updatedAt: Date.now() })
          .eq('id', ticketId)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: ticket });
      }

      case 'add-ticket-comment': {
        const { ticketId, content, isInternal } = body;

        if (!ticketId || !content) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const now = Date.now();
        const { data: comment, error } = await supabaseService
          .from('ticket_comments')
          .insert({
            ticketId,
            userId: authUser.id,
            content,
            isInternal: isInternal || false,
            createdAt: now,
            updatedAt: now,
          })
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: comment });
      }

      case 'resolve-ticket': {
        const { ticketId } = body;

        if (!ticketId) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const now = Date.now();
        const { data: ticket, error } = await supabaseService
          .from('tickets')
          .update({
            status: 'resolved',
            resolvedAt: now,
            updatedAt: now,
          })
          .eq('id', ticketId)
          .select()
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: ticket });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Tickets API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
