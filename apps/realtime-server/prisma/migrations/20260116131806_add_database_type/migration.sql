-- CreateEnum
CREATE TYPE "DatabaseType" AS ENUM ('postgresql', 'mysql');

-- AlterTable
ALTER TABLE "DatabaseConnection" ADD COLUMN     "dbType" "DatabaseType" NOT NULL DEFAULT 'postgresql';
