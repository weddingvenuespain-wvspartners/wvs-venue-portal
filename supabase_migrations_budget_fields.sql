-- Extra fields for budget editor (name, document number, dates, message, description, source proposal)
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS document_number  TEXT,
  ADD COLUMN IF NOT EXISTS issue_date       DATE,
  ADD COLUMN IF NOT EXISTS message          TEXT,
  ADD COLUMN IF NOT EXISTS proposal_id      UUID REFERENCES proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_proposal ON budgets(proposal_id);

-- Optional unique index on document_number (per venue) — uncomment if desired
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_doc_number ON budgets(venue_id, document_number) WHERE document_number IS NOT NULL;
