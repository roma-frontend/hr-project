-- Migration 013: Create ai_evaluations table
-- Stores AI-generated employee performance evaluations

CREATE TABLE IF NOT EXISTS public.ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_user_id ON public.ai_evaluations("userId");
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_created_at ON public.ai_evaluations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_user_created ON public.ai_evaluations("userId", created_at DESC);

-- RLS
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can view their own evaluations
DO $$ BEGIN
  CREATE POLICY "Users can view own ai_evaluations"
    ON public.ai_evaluations
    FOR SELECT
    USING (auth.uid() = "userId");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can view evaluations for users in their organization
DO $$ BEGIN
  CREATE POLICY "Admins can view org ai_evaluations"
    ON public.ai_evaluations
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin')
        AND u.organization_id = (
          SELECT organization_id FROM public.users WHERE id = ai_evaluations."userId"
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admins can insert evaluations for users in their organization
DO $$ BEGIN
  CREATE POLICY "Admins can insert ai_evaluations"
    ON public.ai_evaluations
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin')
        AND u.organization_id = (
          SELECT organization_id FROM public.users WHERE id = ai_evaluations."userId"
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
