-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'technical' CHECK (category IN ('technical', 'billing', 'access', 'feature_request', 'bug', 'other')),
  createdBy UUID NOT NULL REFERENCES public.users(id),
  assignedTo UUID REFERENCES public.users(id),
  resolvedAt BIGINT,
  closedAt BIGINT,
  createdAt BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updatedAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" UUID NOT NULL REFERENCES public.tickets(id),
  "userId" UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  "isInternal" BOOLEAN DEFAULT FALSE,
  "createdAt" BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  "updatedAt" BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON public.tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_createdBy ON public.tickets("createdBy");
CREATE INDEX IF NOT EXISTS idx_tickets_assignedTo ON public.tickets("assignedTo");
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_createdAt ON public.tickets("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticketId ON public.ticket_comments("ticketId");
CREATE INDEX IF NOT EXISTS idx_ticket_comments_userId ON public.ticket_comments("userId");

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can view tickets in their organization" ON public.tickets
    FOR SELECT USING (organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create tickets" ON public.tickets
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update tickets in their organization" ON public.tickets
    FOR UPDATE USING (organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS policies for ticket_comments (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can view ticket comments" ON public.ticket_comments
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = public.ticket_comments."ticketId"
      AND (t.organization_id IS NULL OR t.organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
      ))
    ));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create ticket comments" ON public.ticket_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
