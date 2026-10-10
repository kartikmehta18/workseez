-- AlterTable
-- The client's approve / reject on a post, with an optional reason for a
-- rejection. All three are nullable and unset on existing rows, which is the
-- "not decided yet" state — nothing is backfilled.
ALTER TABLE `ContentPost`
    ADD COLUMN `approval` VARCHAR(191) NULL,
    ADD COLUMN `approvalNote` TEXT NULL,
    ADD COLUMN `approvalAt` DATETIME(3) NULL;
