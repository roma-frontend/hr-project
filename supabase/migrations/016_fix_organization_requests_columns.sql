-- Migration 016: Add missing columns to organization_requests
-- The table was created with an older schema, this adds the missing columns

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requester_email'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requester_email VARCHAR(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requester_password'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requester_password VARCHAR(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requested_plan'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requested_plan org_plan;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'industry'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN industry VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'country'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN country VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'team_size'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN team_size VARCHAR(50);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN description TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN status request_status NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN reviewed_by UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN reviewed_at BIGINT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'userid'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN userid UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requester_phone'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requester_phone VARCHAR(50);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requested_name'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requested_name VARCHAR(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requested_slug'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requested_slug VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organization_requests' 
    AND column_name = 'requester_name'
  ) THEN
    ALTER TABLE organization_requests ADD COLUMN requester_name VARCHAR(255);
  END IF;
END $$;
