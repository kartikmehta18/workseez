const activity = [
  {
    initials: "AK",
    name: "Aarav Khanna",
    detail: "Uploaded Project Brief",
    time: "2 min ago",
    color: "bg-blue-100 text-blue-700",
  },
  {
    initials: "SL",
    name: "Sofia Lee",
    detail: "Approved the latest proposal",
    time: "18 min ago",
    color: "bg-violet-100 text-violet-700",
  },
  {
    initials: "MR",
    name: "Maya Rao",
    detail: "Left feedback on the design",
    time: "1 hr ago",
    color: "bg-rose-100 text-rose-700",
  },
]

export function Hero195() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fbff] text-[#061127]">
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-156 bg-[radial-gradient(circle_at_82%_18%,rgba(178,215,255,0.78),transparent_31%),radial-gradient(circle_at_16%_30%,rgba(230,240,255,0.96),transparent_32%)]"
        />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-[#023781] text-sm font-bold text-white shadow-lg shadow-blue-900/15">
              W
            </span>
            <span>Workseez</span>
          </a>
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a className="transition hover:text-[#023781]" href="#features">
              Features
            </a>
            <a className="transition hover:text-[#023781]" href="#how-it-works">
              How it works
            </a>
            <a className="transition hover:text-[#023781]" href="#contact">
              Contact
            </a>
          </nav>
          <a
            href="#get-started"
            className="rounded-full border border-blue-900/10 bg-white px-4 py-2 text-sm font-semibold text-[#023781] shadow-sm transition hover:border-[#023781]/30 hover:bg-blue-50"
          >
            Sign in
          </a>
        </header>

        <section id="top" className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:pb-28 lg:pt-20">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-3 py-1.5 text-sm font-medium text-[#023781] shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-[#a8498c]" />
              Your client work, beautifully organised
            </div>

            <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#061127] sm:text-6xl lg:text-7xl">
              Make every client feel <span className="text-[#023781]">in the loop.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              A calm, polished client portal for sharing progress, collecting feedback, and keeping important work moving forward.
            </p>

            <div id="get-started" className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:hello@workseez.com?subject=I%20want%20to%20get%20started"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#023781] px-6 text-sm font-semibold text-white shadow-xl shadow-blue-900/20 transition hover:-translate-y-0.5 hover:bg-[#012c67]"
              >
                Start your workspace
                <span aria-hidden="true" className="ml-2 text-lg leading-none">
                  →
                </span>
              </a>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                See how it works
              </a>
            </div>

            <p className="mt-5 text-sm text-slate-500">No credit card required · Set up in minutes</p>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
            <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-[3rem] bg-linear-to-br from-blue-200/70 via-white to-violet-200/70 blur-2xl" />

            <div className="overflow-hidden rounded-3xl border border-white/90 bg-white p-3 shadow-[0_30px_80px_-28px_rgba(2,55,129,0.38)] ring-1 ring-blue-900/5 sm:p-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-[#ff8a7a]" />
                    <span className="size-2.5 rounded-full bg-[#f6c85f]" />
                    <span className="size-2.5 rounded-full bg-[#7ad39a]" />
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                    Acme rebrand
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-[0.82fr_1.18fr]">
                  <aside className="rounded-2xl bg-[#061127] p-4 text-white">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="grid size-6 place-items-center rounded-lg bg-white/15 text-xs">W</span>
                      Workseez
                    </div>

                    <div className="mt-8 space-y-2 text-xs text-slate-300">
                      <p className="rounded-lg bg-white/10 px-3 py-2 font-medium text-white">Overview</p>
                      <p className="px-3 py-2">Files</p>
                      <p className="px-3 py-2">Feedback</p>
                      <p className="px-3 py-2">Messages</p>
                    </div>

                    <div className="mt-10 rounded-xl bg-white/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Project health</p>
                      <p className="mt-2 text-lg font-semibold">On track</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full w-[76%] rounded-full bg-[#86b7ff]" />
                      </div>
                    </div>
                  </aside>

                  <div className="space-y-4">
                    <div className="rounded-2xl bg-linear-to-br from-[#dbeafe] to-[#eff6ff] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#4872ad]">Good morning, Acme</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold tracking-tight text-[#061127]">Everything is moving.</h2>
                          <p className="mt-1 text-xs text-slate-600">Your weekly project update is ready.</p>
                        </div>
                        <span className="hidden size-11 rounded-2xl bg-white/75 sm:block" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Latest activity</p>
                        <button type="button" className="text-xs font-semibold text-[#023781]">
                          View all
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {activity.map((item) => (
                          <div key={item.name} className="flex items-center gap-2.5">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-bold ${item.color}`}>
                              {item.initials}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-800">{item.name}</span> {item.detail}
                            </p>
                            <span className="shrink-0 text-[10px] text-slate-400">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-7 -left-5 hidden rounded-2xl border border-white bg-white p-3 shadow-xl shadow-blue-950/10 sm:flex sm:items-center sm:gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-lg text-emerald-700">✓</span>
              <p className="text-xs font-semibold text-slate-700">
                Client update sent
                <br />
                <span className="font-normal text-slate-400">Just now</span>
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200/80 bg-white px-6 py-8 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 text-center sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <p className="text-sm font-medium text-slate-500">
              <span className="mr-2 text-xl font-semibold text-[#023781]">1 place</span> for every project detail
            </p>
            <p className="text-sm font-medium text-slate-500">
              <span className="mr-2 text-xl font-semibold text-[#023781]">Clearer</span> feedback and approvals
            </p>
            <p className="text-sm font-medium text-slate-500">
              <span className="mr-2 text-xl font-semibold text-[#023781]">Less</span> chasing, more progress
            </p>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-3xl px-6 py-20 text-center lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a8498c]">A better client experience</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#061127] sm:text-4xl">
            Give great work the space it deserves.
          </h2>
          <p id="contact" className="mt-4 text-slate-600">
            Bring files, conversations, and milestones into one clear, welcoming home for your clients.
          </p>
        </section>
      </div>
    </main>
  )
}