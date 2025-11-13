-- Add passwordHash and tokenVersion to the User table for authentication
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Populate passwordHash for existing users with a placeholder value
UPDATE "User"
SET "passwordHash" = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8H/0T8eYa5LIvF0a0.xG7nslEi5H3C'
WHERE "passwordHash" IS NULL;

-- Ensure passwordHash is required going forward
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;



