-- ============================================================================
-- Plan System Improvements Migration
-- Date: 2026-06-10
-- ============================================================================

-- 1. Sort order for plans (controls display order on pricing page)
ALTER TABLE venue_plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Comparison text (e.g., "Todo lo de Básico +")
ALTER TABLE venue_plans ADD COLUMN IF NOT EXISTS comparison_text TEXT;

-- 3. Grace period days (days after payment failure before suspension)
ALTER TABLE venue_plans ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;

-- 4. Plan change history / audit log
CREATE TABLE IF NOT EXISTS venue_plan_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES venue_plans(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'activated', 'deactivated', 'deleted'
  changes JSONB, -- { field: { old: ..., new: ... } }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON venue_plan_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_history_date ON venue_plan_history(created_at DESC);

-- 5. Feature overrides per venue (individual venue feature toggles)
-- Already exists via venue_profiles.features_override JSONB
-- But we need a structured table for admin UI management
CREATE TABLE IF NOT EXISTS venue_feature_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT, -- why this override exists
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_overrides_user ON venue_feature_overrides(user_id);

-- 6. Subscription change log (upgrade/downgrade tracking)
ALTER TABLE venue_subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id UUID REFERENCES venue_plans(id);
ALTER TABLE venue_subscriptions ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ;

-- 7. RLS policies
ALTER TABLE venue_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Admin full access to plan history
CREATE POLICY admin_plan_history ON venue_plan_history
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM venue_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin full access to feature overrides
CREATE POLICY admin_feature_overrides ON venue_feature_overrides
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM venue_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Users can read their own feature overrides
CREATE POLICY user_own_overrides ON venue_feature_overrides
  FOR SELECT
  USING (user_id = auth.uid());
