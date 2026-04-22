-- Migration 012: Create organization_join_requests table
-- Tracks requests from users to join organizations

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_name TEXT,
  requester_email TEXT,
  requester_avatar TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at BIGINT,
  review_notes TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_org_join_requests_org_id ON public.organization_join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_requester_id ON public.organization_join_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_status ON public.organization_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_org_status ON public.organization_join_requests(organization_id, status);

-- RLS
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
DO $$ BEGIN
  CREATE POLICY "Users can view own join requests"
    ON public.organization_join_requests
    FOR SELECT
    USING (auth.uid() = requester_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can view requests for their organization
DO $$ BEGIN
  CREATE POLICY "Admins can view org join requests"
    ON public.organization_join_requests
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.organization_id = organization_join_requests.organization_id
        AND users.role IN ('admin', 'superadmin')
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users can insert their own requests
DO $$ BEGIN
  CREATE POLICY "Users can create join requests"
    ON public.organization_join_requests
    FOR INSERT
    WITH CHECK (auth.uid() = requester_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can update requests for their organization
DO $$ BEGIN
  CREATE POLICY "Admins can update org join requests"
    ON public.organization_join_requests
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.organization_id = organization_join_requests.organization_id
        AND users.role IN ('admin', 'superadmin')
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
