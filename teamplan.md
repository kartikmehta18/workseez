# Team management: internal production board

## Context

Today the portal tracks a post only by its manual status and by who created it. There is no record of who is researching, designing or animating a post, who is reviewing it, or what is late. The team wants a ClickUp-style board that carries every post through production:

> research → lead team → manager assigns to designer → tick done → review → animator → review → ready for posting

Decisions already taken with the owner:

1. **Researcher, Lead, Designer and Animator are new login roles.** Each signs in and sees only the work assigned to them.
2. **The "tick" is a simple "mark as done"** by whoever holds the task. It sends the card to review.
3. **Both reviews are internal** (lead or manager). The client never sees the board, and no pipeline data reaches the client's browser. The client's existing Approve / Reject is untouched.
4. **The board is a separate internal tracker.** The existing post status stays manual and stays what the client sees. The board never writes to it.
5. **The board is a kanban with drag and drop. Every card is a calendar post.** No sprints, points, free-standing tasks or multiple boards in this version.

The design below was drafted by an architect agent and then reviewed twice, once against the code and once against day-to-day production use. The fixes from both reviews are folded in.

---

## 1. The enhanced flow

### Stages (the board's columns)

| # | Column | Held by | "Done" means | Optional |
|---|---|---|---|---|
| 1 | Research | Researcher | Marked done, notes or link attached if any | Yes |
| 2 | Brief | Lead | Brief for the makers is written, marked done | No |
| 3 | Design | Designer | Marked done (file link optional) | Yes* |
| 4 | Design review | Owner (lead or manager) | Approve, or send back with a reason | With Design |
| 5 | Animation | Animator | Marked done (file link optional) | Yes* |
| 6 | Animation review | Owner (lead or manager) | Approve, or send back with a reason | With Animation |
| 7 | Ready to post | Owner | End of the board | — |

\* At least one of Design or Animation must be in a post's plan. A reel can skip Design; a static LinkedIn post skips Animation.

```
[Research]* ─done→ [Brief] ─done→ [Design]* ─done→ [Design review] ─approve→ [Animation]* ─done→ [Animation review] ─approve→ [Ready to post]
                      ▲              ▲                  │                         ▲                      │
                      └──────────────┴── send back ─────┘                         └──── send back ───────┤
                                     ▲                                                                   │
                                     └────────────────── send back to design ────────────────────────────┘
* optional. "Send to rework" (owner) can move a card from any column back to any earlier work column.
```

### What is added beyond the owner's flow, and why

- **"Lead team" becomes a Brief column.** It needed a definition of done. The lead writes a brief for the makers on the board, separate from the script.
- **"Manager assigns" is not a column.** People can be assigned to every stage when the post enters the board, so a hand-off never waits on a manager. A card whose current stage has nobody on it shows a **Needs assigning** chip.
- **Skippable stages**, chosen when the post is put on the board. Defaults come from the post type (video types get Animation; everything gets Design and Research).
- **Send back with a reason.** Every send-back needs a reason and a new due date, and counts a round. A card on its third round shows a "Stuck in rework" chip.
- **One owner per card** (a lead or manager; defaults to whoever put the post on the board). The owner is the default reviewer at both gates and receives the "ready to post" hand-over. Any lead or manager on that client can still review.
- **Due date per stage**, pre-filled by working backwards from the post's planned date.
- **Late and at-risk flags**, computed when the board loads: step overdue, in a column too long, or the planned date is within two days and the card is not Ready.
- **Blocked.** A maker can flag "I'm blocked" with a reason (unclear brief, waiting on footage). It shows an amber chip instead of red overdue and notifies the owner.
- **Urgent.** The owner can mark a card urgent; it sorts first everywhere.
- **Client rejection brings the card back.** If the client rejects the post, the card shows a "Client rejected" chip until someone sends it to rework. The reason is pre-filled from the client's note.
- **After Ready.** Ready cards show the planned date with "Post today" / "Late to post", whether the client has approved, and the last approved file link. They drop off the board a week after the post's status goes live.
- **Start mid-flight and in bulk.** A post already in design on launch day can be placed straight into Design. "Add all posts to the board" on a calendar applies one set of assignees to every untracked post.
- **Full history.** Every assignment, tick, verdict, send-back and note is logged with who did it.

### Who can do what

| | Super Admin / Admin | Manager, Lead (their clients) | Researcher / Designer / Animator | Client |
|---|---|---|---|---|
| See the board | All clients | Assigned clients | Only their own cards | Never |
| Put a post on the board, set plan, assign, due dates, urgent | Yes | Yes | No | No |
| Mark a work stage done | On behalf | Own, or on behalf | Own active card only | No |
| Approve / send back | Yes | Yes | No | No |
| Send to rework, remove from board | Yes | Yes | No | No |
| Flag blocked, add a note | Yes | Yes | On their own cards | No |

"On behalf" is logged under the real person, so the history never claims the designer clicked.

### Drag and drop rules

A drag is a request for a transition, not a free move. The server decides.

- **Maker** drags their own card one column right: that is the "done" tick.
- **Reviewer** drags a review card right to approve, or left onto an earlier work column to send back (a dialog asks for the reason and new due date).
- **Owner** drags any card left to send it to rework.
- Any other drop snaps back with a short message saying why.
- Every card also has the same actions as buttons, for touch screens and keyboards.

---

## 2. Roles and permissions

`lib/rbac.ts`

- `ROLES` gains `LEAD`, `RESEARCHER`, `DESIGNER`, `ANIMATOR`, with labels and descriptions.
- New permissions:
  - `client:viewAssigned` — scoped through the existing `ClientManager` table. Manager, Lead.
  - `pipeline:manage` — put on board, plan, assign, due dates, rework, remove. Super Admin, Admin, Manager, Lead.
  - `pipeline:review` — approve / send back. Same four.
  - `pipeline:work` — may hold a card. Every role except Client.
- **Lead does not get `content:manage`.** A lead works through the board and writes the brief. They cannot edit scripts, change the post status, publish to the client or write in the client's feedback thread. (See open questions.)
- Researcher, Designer and Animator hold `pipeline:work` only.
- New helpers: `isProductionRole`, `CLIENT_ASSIGNABLE_ROLES` (Admin, Manager, Lead), `invitableRolesFor(actor)`.

Scoping

- `clientScopeFor` in `lib/clients.ts`: replace the `role === "MANAGER"` literal with `can(actor, "client:viewAssigned")`, and add an explicit empty scope for any other non-client role. Today a designer would fall into the client-owner branch and match nothing only by accident.
- The existing content queries, `getVisiblePost`, `PostView` and `toPostView` are **not changed**. Production roles lack `content:manage`, so every existing content action, the upload route and the client pages already refuse them (verified action by action in review).
- One new read path, `getAssignedPost(actor, postId)`, with an explicit `select` whitelist: title, type, platform, planned date, caption, script lines, raw file links, the calendar's edits folder ("save your files here"), client name, and the pipeline. Never selected: internal notes, the client feedback thread, approval fields, client email, client Drive, sibling posts.
- Access is the query: a maker can read a post while they hold an open step on it, or a done step while the card is still in production. It ends when the card reaches Ready or they are reassigned.
- Assigning a Manager or Lead to a step, or making them owner, requires that they are on that client. Removing them from the client (`setClientManager`) clears their open steps and ownership there.

Existing role switches that change (the rest were checked and need nothing)

- `settings/access/actions.ts` — `inviteTeamMember` uses `invitableRolesFor`; `setUserRole`, disable and delete unassign that user's open steps in the same transaction.
- `invite-member-dialog.tsx`, `user-directory.tsx` (role counts, tabs, scope column), `settings/page.tsx` copy.
- `clients/actions.ts` `setClientManager`, `clients/[id]/page.tsx`, `manager-assignment.tsx` — leads become assignable to clients.
- `dashboard-sidebar.tsx` `navFor`, `app/dashboard/page.tsx`, and redirects on `clients`, `onboarding`, `strategy`, `content` pages for roles that should not be there.
- `clients/[id]/page.tsx` gains a `content:manage` / `client:edit` gate so a lead cannot open the client profile.
- `lib/emails.ts` `sendTeamInviteEmail` — production roles get "Sign in to see the work assigned to you."

---

## 3. Data model

Separate tables, not columns on `ContentPost`. `getVisiblePost` loads every post column on the client's path and `savePost` rewrites the row, so pipeline fields there would be one careless spread from the client's payload. `ContentPost` gains only a back-relation, which adds no column.

```prisma
model ContentPipeline {
  id             String    @id @default(cuid())
  postId         String    @unique
  stage          String    @default("BRIEF")  // RESEARCH | BRIEF | DESIGN | DESIGN_REVIEW | ANIMATION | ANIMATION_REVIEW | READY | CANCELLED
  round          Int       @default(0)        // send-backs so far; also the stale-screen guard
  urgent         Boolean   @default(false)
  brief          String?   @db.Text           // the lead's instructions to the makers
  stageEnteredAt DateTime  @default(now())
  readyAt        DateTime?
  ownerId        String?                      // reviewer by default, and who posts
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  // relations: post (Cascade), owner (SetNull), steps, events
  @@index([stage])
  @@index([ownerId])
}

model ContentPipelineStep {            // one row per stage in the post's plan
  id             String    @id @default(cuid())
  pipelineId     String
  stage          String
  state          String    @default("PENDING") // PENDING | ACTIVE | DONE | SKIPPED
  assigneeId     String?
  dueAt          DateTime?
  deliverableUrl String?   @db.Text
  doneNote       String?   @db.Text
  blockedReason  String?   @db.Text
  blockedAt      DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  @@unique([pipelineId, stage])
  @@index([assigneeId, state])
  @@index([state, dueAt])
}

model ContentPipelineEvent {           // the history
  id             String   @id @default(cuid())
  pipelineId     String
  type           String   // STARTED | ASSIGNED | UNASSIGNED | DUE_CHANGED | SUBMITTED | APPROVED | SENT_BACK | REWORK | BLOCKED | UNBLOCKED | READY | CANCELLED | NOTE
  fromStage      String?
  toStage        String?
  round          Int      @default(0)
  actorId        String?
  actorRole      String?  // snapshot, as ContentComment.authorRole does
  subjectId      String?  // the assignee affected
  note           String?  @db.Text
  deliverableUrl String?  @db.Text  // snapshot per submission, so earlier rounds stay visible
  createdAt      DateTime @default(now())
  @@index([pipelineId, createdAt])
}
```

Migration: `prisma/migrations/20261013000000_add_content_pipeline/migration.sql`, hand-written. Table and foreign-key structure follows `20260729000000_add_content_calendar`; the rationale-comment style follows `20261011000000_add_post_approval`. No backfill: a post with no pipeline row is simply "not on the board". The new roles need no migration because `User.role` is a plain string.

---

## 4. Server side

**`lib/pipeline.ts`** (pure, no prisma, like `lib/content.ts`): stage list, labels and hints, `STAGE_ROLES`, `defaultPlanFor(kind, platform)`, `nextStage`, `sendBackTargets`, `resolveTransition(pipeline, action)` as the single transition table, `suggestDueDates(scheduledFor, plan)`, `isOverdue`, `isAtRisk`, and the `BoardCard` / `PipelineDetail` view types.

**`lib/pipeline-queries.ts`**: `listBoard(actor, filters)` (managers: scoped with `clientScopeFor`; makers: only cards they hold a step on), `getPipelineDetail`, `getAssignedPost`, `listAssignableUsers(stage, clientId)` returning each person's open and late counts so nobody assigns blind, `pipelineRecipients`. `listAssignableUsers` is called only from gated pages and actions and is never exported as an action.

**`app/dashboard/pipeline/actions.ts`** — all take `FormData`, return `ActionResult`, and re-check permission and client scope:

| Action | Who | Guard |
|---|---|---|
| `startPipeline` / `startPipelineForCalendar` | `pipeline:manage` | No existing pipeline; plan has Design or Animation; optional `startStage` writes earlier stages as skipped |
| `assignStep`, `setStepDue`, `saveBrief`, `setOwner`, `setUrgent`, `toggleStage` | `pipeline:manage` | Assignee is not disabled, has a role allowed for the stage, and is on the client if client-scoped; only a future optional stage can be toggled |
| `submitStep` (the tick) | Holder of the active step, or `pipeline:manage` on behalf | Stage is a work stage; link optional, must be http(s) if given |
| `reviewStep` (approve / send back) | `pipeline:review` | Stage is a review stage; send-back needs a reason, a target from `sendBackTargets`, and a new due date |
| `sendToRework` | `pipeline:manage` | Any stage to any earlier work stage in the plan; reason required |
| `setBlocked`, `addPipelineNote` | Holder, or `pipeline:manage` | Reason / note length |
| `reassignOpenWork(from, to, clientId?)` | `pipeline:manage` | Covers leave: moves every open step in scope, one event each |
| `cancelPipeline` | `pipeline:manage` | Takes the card off the board, history kept |
| `moveCard(postId, toStage)` | — | The drag handler: resolves which of the above the drop means, or refuses |

Rules that hold for every transition:

- One helper runs each in `prisma.$transaction`. Its first statement is `contentPipeline.updateMany({ where: { id, stage: from, round: submittedRound } })`. A count of 0 means the screen was stale; the user gets "Someone else just updated this" and a refresh. Step writes are conditional the same way (`state: "ACTIVE"`, expected assignee).
- A send-back or rework to stage X sets X to active and every later non-skipped step back to pending, keeping its assignee and clearing its timestamps.
- **No action in this file writes `ContentPost`.**
- Revalidate `/dashboard`, `/dashboard/board`, the client's content page, then `refresh()`, mirroring `revalidateCalendar` in `content/actions.ts`.

---

## 5. UI

| Role | Lands on | Sidebar |
|---|---|---|
| Researcher / Designer / Animator | `/dashboard/board` (their cards only) | Board, Settings |
| Lead | `/dashboard` | Overview, Board, Settings |
| Manager | `/dashboard` | Existing items + Board |
| Admin / Super Admin | `/dashboard` | Existing items + Board |
| Client | Unchanged | Unchanged |

**`/dashboard/board`** — the kanban (the ClickUp reference).

- Seven columns as in section 1, each with a count; horizontal scroll, as in the reference.
- Card: post title, client name, type icon (`KindIcon`) and platform mark (`PlatformIcon`) from `content-badges.tsx`, assignee avatar, due chip, and chips for Urgent, Blocked, Needs assigning, Sent back, Client rejected, Late.
- Header: search, filters (client, person, late, blocked, needs assigning), group by person, and member avatars with open counts.
- Managers and leads see every card in their scope and can act on all. A maker sees the same board holding only their cards.
- Clicking a card opens a side sheet (`components/ui/sheet.tsx`): brief, script (reusing `ScriptView`), caption, reference links, "save your files here" folder, stage stepper with assignees and due dates, action buttons, history and notes.
- Drag and drop with `@dnd-kit/core` (new dependency; nothing for drag is installed today). Confirm it supports React 19.2 at install time; if not, fall back to native HTML drag events. The card is moved optimistically and snaps back if the server refuses.

**Dashboard home** (`app/dashboard/page.tsx`, for `pipeline:manage`): a "Needs attention" strip — awaiting my review, needs assigning, late, blocked, client rejected, late to post — each linking to the board with that filter.

**Post card on the calendar** (team only): a stage badge and an "Add to board" / "Open on board" control. `clients/[id]/content/page.tsx` builds these on the server and passes them into `PostList` → `PostCard` as a slot (`pipelineSlots?: Record<string, React.ReactNode>`). `post-card.tsx` and `post-list.tsx` must not import any pipeline module, because those files are also the client's, and the client's JavaScript must not carry the board's code or wording.

**Components** in `app/dashboard/pipeline/_components/`: `board.tsx`, `board-card.tsx`, `card-sheet.tsx`, `start-pipeline-dialog.tsx`, `assign-step-dialog.tsx`, `submit-step-dialog.tsx`, `review-dialog.tsx`, `pipeline-timeline.tsx`, `pipeline-badges.tsx`. Dialogs follow the controlled / uncontrolled pattern of `CreatePostDialog`, with `useTransition` and sonner toasts.

**Settings → Access**: the invite dialog is driven by `invitableRolesFor`; the role tabs and scope column pick up the new roles.

---

## 6. Emails

Four mails only, added to `lib/emails.ts` over the existing `renderLayout`, sent inside `after()` with try/catch as the content mails are. Recipients come from `pipelineRecipients`, which never loads the client. Nobody is mailed about their own action.

| Event | To |
|---|---|
| Your turn (assigned, or your stage became active) | The assignee |
| Needs review | The owner |
| Sent back, with the reason | The maker it returns to |
| Ready to post, with the approved file link | The owner |

A blocked flag and "nobody assigned" also notify the owner using the "your turn" template. Mail is best-effort; the board is the source of truth.

---

## 7. Phases

Each phase ships on its own.

1. **Roles and access.** `lib/rbac.ts`, `lib/clients.ts`, the settings/access files, client-manager assignment, sidebar, redirects, invite email copy. New roles can be invited and sign in to an empty board page.
2. **Data model and the board for managers.** Schema, migration, `lib/pipeline.ts`, `lib/pipeline-queries.ts`, `pipeline/actions.ts`, the board with buttons (no drag yet), card sheet, dialogs, single and bulk start, the calendar slot, unassign hooks.
3. **Makers and attention.** Maker view of the board, submit and blocked, the dashboard "Needs attention" strip, the four emails.
4. **Drag and drop**, grouping by person, `reassignOpenWork`, urgent, at-risk chips.

Later ideas, not in this plan: sprints and points, free-standing tasks, multiple boards, in-portal file upload for makers (must not create a `ContentAsset`, which the client can see), a daily overdue digest, a button to copy an approved file into the post's client-visible final link.

---

## 8. Verification

There is no test suite. Per phase: `npx prisma validate`, `npx tsc --noEmit`, `npm run lint`, then by hand in `next dev` (restart it first; its generated `.next/dev/types/validator.ts` is currently corrupted). Apply the migration to a throwaway database with `npx prisma migrate deploy` before the real one.

Happy paths
- Static LinkedIn post: Brief → Design → Design review → Ready.
- Reel, full path, with a send-back at each gate and one from Animation review to Design; on the second pass the later steps are pending again and earlier submissions still show in the history.
- Start mid-flight at Animation; bulk-start a 30-post calendar.
- Client rejects a post while its card is in Design: chip appears, rework clears it.
- Reassign all of one person's open work; remove a lead from a client.
- After every board action, the post's `status` and `updatedAt` are unchanged in the database.

Two people at once
- Two browsers approve and send back the same review: one wins, the other gets the stale message.
- Designer resubmits while the reviewer's dialog is open: the approve is refused.
- Two "Add to board" clicks: one pipeline.

Must fail
- Designer opens `/dashboard/clients`, a client page, `/dashboard/content`, `/dashboard/settings/access`: redirect or 404.
- Designer opens or drags a card that is not theirs, calls `reviewStep`, `assignStep` or `startPipeline`, or any existing content action (`savePost`, `loadPostDetail`, `addPostComment`, `setPostApproval`, upload): refused.
- The designer's card sheet response contains no internal notes, client feedback, approval note, client email or client Drive link.
- Animator ticks before Design review is approved: refused.
- Lead cannot edit a script, change status or publish to the client.
- Manager or lead acts on a client they are not on: not found.
- Client: `/dashboard/board` redirects, every pipeline action is refused, and neither the `/dashboard/content` response nor its JavaScript contains pipeline data or wording.
- Assigning a designer to Animation, a disabled user, or a manager who is not on the client: refused.

---

## 9. Open questions and risks

- **Lead's reach.** This plan keeps leads on the board only: they write the brief and review, but cannot edit scripts or publish to the client. If leads should write scripts too, that needs a new narrower permission so they still cannot publish or message the client.
- **One person, two crafts.** A designer cannot be assigned Animation. If someone does both, either give them a second login role or loosen `STAGE_ROLES` (one constant).
- **Files are links.** Makers save to the calendar's edits folder and paste the link. Drive sharing is outside the portal, so a reviewer may hit a link they cannot open.
- **No scheduler.** "Late" is shown on screen only; nobody is chased automatically.
- **Deleting a post** removes its board history, the same as its comments today.
- **Changing a post's type** after it is on the board does not change its plan; the card shows a hint when they disagree.
- **This Next.js has breaking changes.** `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` before writing code for each phase.

