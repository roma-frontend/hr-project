-- Migration 014: Create service_broadcasts table
-- Stores organization-wide broadcast/announcement messages

CREATE TABLE IF NOT EXISTS public.service_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'ℹ️',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_service_broadcasts_org_id ON public.service_broadcasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_broadcasts_created_at ON public.service_broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_broadcasts_org_created ON public.service_broadcasts(organization_id, created_at DESC);

-- RLS
ALTER TABLE public.service_broadcasts ENABLE ROW LEVEL SECURITY;

-- All users in the organization can view broadcasts
DO $$ BEGIN
  CREATE POLICY "Users can view org service_broadcasts"
    ON public.service_broadcasts
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id = service_broadcasts.organization_id
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can insert broadcasts for their organization
DO $$ BEGIN
  CREATE POLICY "Admins can insert service_broadcasts"
    ON public.service_broadcasts
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id = service_broadcasts.organization_id
        AND u.role IN ('admin', 'superadmin')
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can delete broadcasts for their organization
DO $$ BEGIN
  CREATE POLICY "Admins can delete service_broadcasts"
    ON public.service_broadcasts
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id = service_broadcasts.organization_id
        AND u.role IN ('admin', 'superadmin')
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
