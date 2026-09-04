-- AlterTable
-- A client can now be created without an email: the 6-digit access key is the
-- login, and the invite mail is only sent when there is somewhere to send it.
-- The UNIQUE index is kept — MySQL permits any number of NULLs in one, so many
-- email-less clients coexist while real addresses stay unique.
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;
