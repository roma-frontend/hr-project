-- Migration 015: Rename maintenance_mode to maintenance_modes
-- Fixes table name mismatch between migration (singular) and code (plural)

-- Rename table (idempotent - only if old table exists and new doesn't)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_mode' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_modes' AND table_schema = 'public') THEN
    ALTER TABLE public.maintenance_mode RENAME TO maintenance_modes;
  END IF;
EXCEPTION WHEN undefined_table THEN null;
END $$;

-- Update indexes (idempotent - only if old indexes exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_maintenance_org' AND schemaname = 'public') THEN
    ALTER INDEX idx_maintenance_org RENAME TO idx_maintenance_modes_org;
  END IF;
EXCEPTION WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_maintenance_active' AND schemaname = 'public') THEN
    ALTER INDEX idx_maintenance_active RENAME TO idx_maintenance_modes_active;
  END IF;
EXCEPTION WHEN undefined_object THEN null;
END $$;

-- Update trigger (drop old, create new)
DROP TRIGGER IF EXISTS update_maintenance_mode_updated_at ON public.maintenance_modes;
DROP TRIGGER IF EXISTS update_maintenance_modes_updated_at ON public.maintenance_modes;
CREATE TRIGGER update_maintenance_modes_updated_at
    BEFORE UPDATE ON public.maintenance_modes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update RLS (safe to run multiple times)
ALTER TABLE public.maintenance_modes ENABLE ROW LEVEL SECURITY;

-- Re-create policies with new table name (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can view org maintenance_modes"
    ON public.maintenance_modes
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.organization_id = maintenance_modes.organization_id
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage maintenance_modes"
    ON public.maintenance_modes
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.organization_id = maintenance_modes.organization_id
        AND users.role IN ('admin', 'superadmin')
      )
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
