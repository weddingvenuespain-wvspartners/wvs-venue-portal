-- Add commercial config / modality / lodging refs to budgets (imported from proposal)
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS commercial_config_id UUID REFERENCES venue_commercial_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modality_id UUID REFERENCES venue_modalities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lodging_config_id UUID REFERENCES venue_commercial_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_commercial_config ON budgets(commercial_config_id);
CREATE INDEX IF NOT EXISTS idx_budgets_modality ON budgets(modality_id);
CREATE INDEX IF NOT EXISTS idx_budgets_lodging_config ON budgets(lodging_config_id);
