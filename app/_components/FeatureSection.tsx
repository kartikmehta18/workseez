"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

import { GoogleDriveIcon } from "@/components/ui/google-drive-icon"
import { cn } from "@/lib/utils"


interface Feature {
  title: string
  description: string
  skeleton: ReactNode
  className: string
}

const features: Feature[] = [
  {
    title: "Every conversation in one thread",
    description:
      "Feedback, approvals and questions live right next to the work — no more digging through email.",
    skeleton: <SkeletonFeedback />,
    className: "col-span-1 lg:col-span-2 border-b lg:border-r border-border",
  },
  {
    title: "Secure client file sharing",
    description:
      "Give each client their own Google Drive workspace, shared with exactly the right people.",
    skeleton: <SkeletonFileSharing />,
    className: "col-span-1 lg:col-span-2 border-b lg:border-r border-border",
  },
  {
    title: "Strategy sheets, signed off together",
    description:
      "Draft the plan, gather feedback inline, and capture a formal client sign-off — all in one live document.",
    skeleton: <SkeletonStrategy />,
    className:
      "col-span-1 lg:col-span-2 lg:row-span-2 border-b lg:border-b-0 border-border",
  },
  {
    title: "Content review, made effortless for clients",
    description:
      "Clients see everything queued for them in one place and approve or request changes in a single click — no logins to chase, no scattered email.",
    skeleton: <SkeletonContentReview />,
    className: "col-span-1 lg:col-span-4 lg:border-r border-border",
  },
]

const FeatureSection = () => {
  return (
    <section className="overflow-hidden bg-background py-12 md:py-20">
      <div className="container max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
            Everything a client relationship needs
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            From kickoff to sign-off, one portal keeps your team and your clients
            working from the same page.
          </p>
        </div>

        <div className="grid grid-cols-1 rounded-2xl border border-border bg-card lg:grid-cols-6">
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className}>
              <div className="h-full min-h-[15rem] w-full grow">
                {feature.skeleton}
              </div>
              <div className="p-6 pt-2">
                <h3 className="text-lg font-semibold tracking-tight text-primary">
                  {feature.title}
                </h3>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </section>
  )
}

const FeatureCard = ({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) => {
  return (
    <div className={cn("group flex flex-col overflow-hidden", className)}>
      {children}
    </div>
  )
}


const Avatar = ({
  gradient,
  initials,
  className,
}: {
  gradient: string
  initials: string
  className?: string
}) => (
  <span
    className={cn(
      "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white shadow-sm",
      gradient,
      className,
    )}
    aria-hidden
  >
    {initials}
  </span>
)

/* -------------------------------------------------------------------------- */
/*  1 — Feedback thread (client ↔ manager)                                     */
/* -------------------------------------------------------------------------- */

const messages = [
  { from: "client", text: "Loved the draft — one tweak on the headline?" },
  { from: "manager", text: "On it. Sending a v2 in a few minutes." },
  { from: "client", text: "Perfect, thank you! 🙌" },
  { from: "manager", text: "v2 is up for your sign-off." },
] as const

function SkeletonFeedback() {
  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.18, delayChildren: 0.1 },
    },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="flex h-full flex-col justify-center gap-3 p-6"
    >
      {messages.map((message, index) => {
        const mine = message.from === "manager"
        return (
          <motion.div
            key={index}
            variants={{
              hidden: { opacity: 0, x: mine ? 24 : -24, scale: 0.95 },
              show: {
                opacity: 1,
                x: 0,
                scale: 1,
                transition: { type: "spring", stiffness: 260, damping: 22 },
              },
            }}
            whileHover={{ x: mine ? -6 : 6, transition: { duration: 0.2 } }}
            className={cn(
              "flex items-center gap-2",
              mine ? "flex-row-reverse self-end" : "self-start",
            )}
          >
            <Avatar
              gradient={
                mine
                  ? "from-sky-400 to-blue-600"
                  : "from-rose-400 to-orange-500"
              }
              initials={mine ? "You" : "C"}
              className={mine ? "text-[8px]" : ""}
            />
            <span
              className={cn(
                "max-w-[12rem] rounded-2xl border px-3 py-1.5 text-xs shadow-sm",
                mine
                  ? "border-blue-100 bg-blue-50 text-blue-700"
                  : "border-border bg-background text-primary",
              )}
            >
              {message.text}
            </span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  2 — Secure file sharing (Google Drive workspace)                           */
/* -------------------------------------------------------------------------- */

function SkeletonFileSharing() {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      {/* dashed connector rails */}
      <div className="pointer-events-none absolute inset-x-8 top-1/2 -z-0 flex -translate-y-1/2 flex-col gap-6 opacity-60">
        <div className="h-px w-full border-t border-dashed border-border" />
        <div className="h-px w-full border-t border-dashed border-border" />
      </div>

      <div className="relative z-10 flex w-full items-center justify-between px-4">
        {/* client Drive folder, lifts and tilts on hover */}
        <motion.div
          initial={{ rotate: -4 }}
          whileHover={{ y: -8, rotate: 0, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative"
        >
          <div className="relative flex h-16 w-20 items-center justify-center rounded-lg rounded-tl-none bg-gradient-to-br from-amber-300 to-amber-500 shadow-md">
            <div className="absolute -top-2 left-0 h-3 w-9 rounded-t-md bg-amber-400" />
            <span className="flex size-8 items-center justify-center rounded-full bg-white/95 shadow">
              <GoogleDriveIcon className="size-4" />
            </span>
          </div>
        </motion.div>

        {/* animated transfer dot */}
        <motion.span
          className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          animate={{ x: [-28, 28], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* shared document card */}
        <motion.div
          initial={{ rotate: 3 }}
          whileHover={{ y: -8, rotate: 0, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="flex h-20 w-16 flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5 shadow-md"
        >
          <div className="h-1.5 w-8 rounded-full bg-primary/70" />
          <div className="h-1.5 w-full rounded-full bg-muted" />
          <div className="h-1.5 w-full rounded-full bg-muted" />
          <div className="h-1.5 w-2/3 rounded-full bg-muted" />
        </motion.div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  3 — Strategy sheet (collaborative doc + live cursors, ending in sign-off)  */
/* -------------------------------------------------------------------------- */

const docLines: { w: string; c: string; heading?: boolean }[] = [
  { w: "w-28", c: "bg-primary/70", heading: true },
  { w: "w-full", c: "bg-muted" },
  { w: "w-11/12", c: "bg-muted" },
  { w: "w-4/5", c: "bg-muted" },
  { w: "w-20", c: "bg-violet-400", heading: true },
  { w: "w-full", c: "bg-muted" },
  { w: "w-3/4", c: "bg-muted" },
]

function SkeletonStrategy() {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="relative w-full max-w-xs overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        {/* doc title bar */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="h-1.5 w-24 rounded-full bg-muted-foreground/40" />
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
            Live
          </span>
        </div>

        {/* doc body */}
        <div className="flex flex-col gap-2.5 p-4">
          {docLines.map((line, index) => (
            <motion.span
              key={index}
              className={cn(
                "rounded-full",
                line.heading ? "h-2.5" : "h-2",
                line.w,
                line.c,
              )}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.4,
                delay: index * 0.09,
                ease: "easeOut",
              }}
              style={{ transformOrigin: "left" }}
            />
          ))}

          {/* sign-off row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              ✓
            </span>
            <span className="h-1.5 w-16 rounded-full bg-emerald-400/70" />
            <span className="ml-auto text-[9px] font-medium text-emerald-700">
              Signed off
            </span>
          </motion.div>
        </div>

        {/* live cursors */}
        <Cursor
          name="Manager"
          color="bg-emerald-500"
          initial={{ x: 150, y: 40 }}
          animate={{ x: [150, 120, 175, 150], y: [40, 120, 90, 40] }}
        />
        <Cursor
          name="Client"
          color="bg-blue-500"
          initial={{ x: 90, y: 150 }}
          animate={{ x: [90, 160, 110, 90], y: [150, 100, 180, 150] }}
        />
      </div>
    </div>
  )
}

function Cursor({
  name,
  color,
  initial,
  animate,
}: {
  name: string
  color: string
  initial: { x: number; y: number }
  animate: { x: number[]; y: number[] }
}) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-20 flex items-center gap-1"
      initial={initial}
      animate={animate}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.35, 0.7, 1],
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M1 1L6.5 15L8.5 9L14.5 7L1 1Z"
          className={cn(
            "fill-current",
            color === "bg-emerald-500" ? "text-emerald-500" : "text-blue-500",
          )}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm",
          color,
        )}
      >
        {name}
      </span>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*  4 — Content review (clients approve / request changes in one click)        */
/* -------------------------------------------------------------------------- */

type ReviewStatus = "approved" | "pending" | "changes"

const reviewCards: {
  title: string
  meta: string
  status: ReviewStatus
  thumb: string
  initials: string
  gradient: string
}[] = [
  {
    title: "Launch week — carousel post",
    meta: "Instagram · Scheduled Fri",
    status: "approved",
    thumb: "from-sky-200 to-indigo-200",
    initials: "IG",
    gradient: "from-sky-400 to-indigo-500",
  },
  {
    title: "Founder story — short video",
    meta: "LinkedIn · Draft",
    status: "pending",
    thumb: "from-rose-200 to-pink-200",
    initials: "IN",
    gradient: "from-rose-400 to-pink-500",
  },
  {
    title: "Product teaser — reel",
    meta: "TikTok · Awaiting review",
    status: "changes",
    thumb: "from-emerald-200 to-teal-200",
    initials: "TT",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    title: "Newsletter — August edition",
    meta: "Email · Scheduled Mon",
    status: "approved",
    thumb: "from-amber-200 to-orange-200",
    initials: "EM",
    gradient: "from-amber-400 to-orange-500",
  },
]

const STATUS_STYLES: Record<
  ReviewStatus,
  { label: string; className: string; dot: string }
> = {
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "In review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  changes: {
    label: "Changes asked",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
}

function SkeletonContentReview() {
  return (
    <div className="group/marquee relative flex h-full items-center overflow-hidden py-6">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card to-transparent" />

      <div className="flex w-max animate-marquee gap-4 pl-4 group-hover/marquee:[animation-play-state:paused]">
        {[...reviewCards, ...reviewCards].map((card, index) => {
          const status = STATUS_STYLES[card.status]
          return (
            <article
              key={index}
              className="flex w-64 shrink-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              {/* content preview */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                    card.thumb,
                  )}
                >
                  <Avatar
                    gradient={card.gradient}
                    initials={card.initials}
                    className="size-6 text-[9px]"
                  />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-xs font-semibold text-primary">
                    {card.title}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {card.meta}
                  </div>
                </div>
              </div>

              {/* status pill */}
              <span
                className={cn(
                  "flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  status.className,
                )}
              >
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </span>

              {/* one-click actions */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium",
                    card.status === "approved"
                      ? "bg-emerald-500 text-white"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                >
                  ✓ Approve
                </span>
                <span className="flex flex-1 items-center justify-center rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                  Request changes
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export { FeatureSection }
