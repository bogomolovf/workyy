-- Add 'pen' to NodeType enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'NodeType' AND e.enumlabel = 'pen') THEN
    ALTER TYPE "NodeType" ADD VALUE 'pen';
  END IF;
END$$;

