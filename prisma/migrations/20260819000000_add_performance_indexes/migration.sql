-- Indexes for the reads the dashboard actually performs.
--
-- The tables were indexed for lookups (every foreign key) but not for the
-- ORDER BY that follows each lookup, so MariaDB found the rows by index and
-- then filesorted them. Two cases mattered most:
--
--   * `Client` had no index on `createdAt`, yet the clients, content, strategy
--     and onboarding list pages all order by it — and for an admin the scope
--     filter is empty, so that was a full table scan plus a filesort on the
--     four busiest pages in the app.
--
--   * `ContentPost` had three single-column indexes but every calendar read
--     filters `calendarId` and then orders by (scheduledFor, sortOrder), so
--     only the first could be used and the rest was a filesort.
--
-- The single-column indexes these overlap are deliberately kept: a composite
-- serves a leading-prefix lookup, but dropping the originals is a separate,
-- riskier change than adding to them.

-- Ordered by `createdAt DESC` on every client list page.
CREATE INDEX `Client_createdAt_idx` ON `Client`(`createdAt` ASC);

-- `WHERE role IN (...) AND status = ...` when listing assignable team members.
CREATE INDEX `User_role_status_idx` ON `User`(`role` ASC, `status` ASC);
-- Secondary sort after `role` in the team directory.
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt` ASC);

-- `WHERE clientId = ? ORDER BY sortOrder` for a client's social links.
CREATE INDEX `ClientLink_clientId_sortOrder_idx` ON `ClientLink`(`clientId` ASC, `sortOrder` ASC);

-- The calendar's real access pattern.
CREATE INDEX `ContentPost_calendarId_scheduledFor_sortOrder_idx` ON `ContentPost`(`calendarId` ASC, `scheduledFor` ASC, `sortOrder` ASC);
-- `WHERE sharedAt IS NOT NULL` — the filter on the client-facing calendar.
CREATE INDEX `ContentPost_sharedAt_idx` ON `ContentPost`(`sharedAt` ASC);

-- Ordered child rows, all previously indexed on the parent key alone.
CREATE INDEX `ContentScriptLine_postId_sortOrder_idx` ON `ContentScriptLine`(`postId` ASC, `sortOrder` ASC);
CREATE INDEX `ContentComment_postId_createdAt_idx` ON `ContentComment`(`postId` ASC, `createdAt` ASC);
CREATE INDEX `ContentAsset_postId_createdAt_idx` ON `ContentAsset`(`postId` ASC, `createdAt` ASC);
CREATE INDEX `StrategyComment_sheetId_createdAt_idx` ON `StrategyComment`(`sheetId` ASC, `createdAt` ASC);
CREATE INDEX `StrategySection_sheetId_sortOrder_idx` ON `StrategySection`(`sheetId` ASC, `sortOrder` ASC);
CREATE INDEX `StrategyColumn_sectionId_sortOrder_idx` ON `StrategyColumn`(`sectionId` ASC, `sortOrder` ASC);
CREATE INDEX `StrategyRow_sectionId_sortOrder_idx` ON `StrategyRow`(`sectionId` ASC, `sortOrder` ASC);
CREATE INDEX `OnboardingSection_formId_sortOrder_idx` ON `OnboardingSection`(`formId` ASC, `sortOrder` ASC);
CREATE INDEX `OnboardingQuestion_sectionId_sortOrder_idx` ON `OnboardingQuestion`(`sectionId` ASC, `sortOrder` ASC);
