-- AlterTable
-- Which channel the post goes out on. Existing rows default to Instagram, which
-- is what every post on the calendar was written for before this column existed.
ALTER TABLE `ContentPost` ADD COLUMN `platform` VARCHAR(191) NOT NULL DEFAULT 'INSTAGRAM' AFTER `kind`;
