-- Posts and carousels move onto their own status track.
--
-- A designed post is never scripted, never waiting on footage, never with an
-- editor and never queued behind an approved cut: it is a topic, then research,
-- then a design, then its caption, then it goes out. CAPTIONING and PUBLISHED
-- are the two steps it shares with the filmed track, and nothing here touches a
-- row already on one of those. The filmed types (REEL, STORY, YOUTUBE) keep the
-- pipeline they already had.
--
-- `status` is a plain VARCHAR rather than an enum (see the note at the top of
-- schema.prisma), so this is data only; there is no column to alter.

-- Where the work has not started. SCRIPTING was the default every static post
-- was created with, so this is nearly all of them.
UPDATE `ContentPost`
SET `status` = 'CONTENT_TOPICS'
WHERE `kind` IN ('POST', 'CAROUSEL')
  AND `status` = 'SCRIPTING';

-- The camera-only statuses. They were never offered for these types in the UI,
-- but the server did not enforce the pairing until now, so a row could hold
-- one. They all land on the same step here: it is being made.
UPDATE `ContentPost`
SET `status` = 'DESIGNING'
WHERE `kind` IN ('POST', 'CAROUSEL')
  AND `status` IN ('SHOOT_PENDING', 'IN_PRODUCTION', 'SCHEDULED');
