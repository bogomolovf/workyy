-- Extend enum "NodeType" with additional values used by the web app.
-- Prisma normally generates this, but we keep a hand-written migration to be idempotent in dev.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'NodeType' AND e.enumlabel = 'note') THEN
    ALTER TYPE "NodeType" ADD VALUE 'note';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'NodeType' AND e.enumlabel = 'text') THEN
    ALTER TYPE "NodeType" ADD VALUE 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'NodeType' AND e.enumlabel = 'shape') THEN
    ALTER TYPE "NodeType" ADD VALUE 'shape';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'NodeType' AND e.enumlabel = 'image') THEN
    ALTER TYPE "NodeType" ADD VALUE 'image';
  END IF;
END$$;


