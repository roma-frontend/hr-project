-- Migration 011: Create ai_site_editor_sessions table
-- Tracks AI site editor usage sessions for limit enforcement and history

CREATE TABLE IF NOT EXISTS public.ai_site_editor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('design', 'content', 'layout', 'logic', 'full_control')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  ai_response TEXT,
  changes_made JSONB DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_site_editor_sessions_user_id ON public.ai_site_editor_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_ai_site_editor_sessions_org_id ON public.ai_site_editor_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_site_editor_sessions_created_at ON public.ai_site_editor_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_site_editor_sessions_org_created ON public.ai_site_editor_sessions(organization_id, created_at);

-- RLS
ALTER TABLE public.ai_site_editor_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
DO $$ BEGIN
  CREATE POLICY "Users can view own ai_site_editor_sessions"
    ON public.ai_site_editor_sessions
    FOR SELECT
    USING (auth.uid() = "userId");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users can insert their own sessions
DO $$ BEGIN
  CREATE POLICY "Users can insert own ai_site_editor_sessions"
    ON public.ai_site_editor_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = "userId");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users can update their own sessions
DO $$ BEGIN
  CREATE POLICY "Users can update own ai_site_editor_sessions"
    ON public.ai_site_editor_sessions
    FOR UPDATE
    USING (auth.uid() = "userId");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Service role has full access (handled by RLS bypass)
