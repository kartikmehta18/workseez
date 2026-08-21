-- The 6-digit access key, the second sign-in method next to Google.
--
-- Two columns hold the same secret for two different jobs. `accessKeyHash` is a
-- salted scrypt hash and is what a sign-in is verified against.
-- `accessKeyFingerprint` is a deterministic HMAC under AUTH_SECRET, and does the
-- two things a salted hash cannot: it is the indexed lookup for a sign-in (the
-- key alone identifies the account, with no email typed) and, being UNIQUE, it
-- is what guarantees no two accounts are ever issued the same digits.
--
-- MySQL treats NULLs as distinct in a unique index, so every account that has
-- no key yet (all of them, at this point) coexists happily.
ALTER TABLE `User`
  ADD COLUMN `accessKeyHash` VARCHAR(191) NULL,
  ADD COLUMN `accessKeyFingerprint` VARCHAR(191) NULL,
  ADD COLUMN `accessKeySetAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_accessKeyFingerprint_key` ON `User`(`accessKeyFingerprint` ASC);
