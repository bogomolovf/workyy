-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'notebook';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'pythonCell';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'markdownCell';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'sqlCell';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'notebookFrame';
