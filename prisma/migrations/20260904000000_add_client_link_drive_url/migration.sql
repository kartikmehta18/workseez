-- AlterTable
-- Per-account Drive folder: each social link (Instagram, LinkedIn, ...) can
-- carry the Drive folder that holds that account's assets. Nullable because
-- every existing row was entered before per-link folders were an option.
ALTER TABLE `ClientLink` ADD COLUMN `driveUrl` TEXT NULL AFTER `url`;
