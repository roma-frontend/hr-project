-- ═══════════════════════════════════════════════════════════════
-- 010_create_leave_conflict_alerts.sql
-- Table for tracking leave conflicts with company events
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leave_conflict_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    leave_start_date TEXT NOT NULL,
    leave_end_date TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    is_reviewed BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at BIGINT,
    review_notes TEXT,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_conflict_alerts_org ON leave_conflict_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_conflict_alerts_employee ON leave_conflict_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_conflict_alerts_event ON leave_conflict_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_conflict_alerts_leave_request ON leave_conflict_alerts(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_conflict_alerts_reviewed ON leave_conflict_alerts(is_reviewed);

ALTER TABLE leave_conflict_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view conflict alerts in their org"
      ON leave_conflict_alerts FOR SELECT
      USING (organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
      ));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage conflict alerts"
      ON leave_conflict_alerts FOR ALL
      USING (
          EXISTS (
              SELECT 1 FROM users
              WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'superadmin')
              AND users.organization_id = leave_conflict_alerts.organization_id
          )
      );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

COMMENT ON TABLE leave_conflict_alerts IS 'Alerts generated when employee leave requests conflict with company events';
