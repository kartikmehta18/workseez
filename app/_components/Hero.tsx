"use client"

import {
  BarChart,
  Database,
  Layers,
  PieChart,
  SquareKanban,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface HeroSaasTab {
  title: string
  image: HeroSaasImage
}

interface HeroSaasImage {
  src: string
  alt: string
  srcDark?: string
}

interface HeroButton {
  text: string
  url: string
  icon?: React.ReactNode
}

interface HeroButtons {
  primary?: HeroButton
  secondary?: HeroButton
}

interface HeroProps {
  className?: string
  heading: string
  description: string
  buttons?: HeroButtons
  tabs?: HeroSaasTab[]
}

type HeroPartialProps = Partial<HeroProps>

const defaultProps: HeroProps = {
  heading: "Every client relationship, in one place.",
  description:
    "A single portal to share projects, track progress, and keep every client conversation moving — without the endless email threads.",
  buttons: {
    primary: {
      text: "Get Started",
      url: "/login",
    },
  },
  tabs: [
    {
      title: "Dashboard",
      image: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/dashboard/admin-dashboard-1.png",
        alt: "Insights dashboard",
      },
    },
    {
      title: "Clients",
      image: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/dashboard/admin-dashboard-2.png",
        alt: "Metrics overview",
      },
    },
    {
      title: "Content Calendar",
      image: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/dashboard/admin-dashboard-3.png",
        alt: "Content calendar with scheduled posts",
      },
    },
    {
      title: "Team",
      image: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/dashboard/admin-users.png",
        alt: "Team and role management",
      },
    },
    {
      title: "Settings",
      image: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/dashboard/admin-developer.png",
        alt: "Workspace settings",
      },
    },
  ],
}

const TAB_ICONS: readonly LucideIcon[] = [
  SquareKanban,
  BarChart,
  PieChart,
  Database,
  Layers,
]

const Hero = (props: HeroPartialProps) => {
  const { heading, description, buttons, tabs = [], className } = {
    ...defaultProps,
    ...props,
  }
  const [activeTab, setActiveTab] = useState(tabs[0]?.title ?? "")
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.title === activeTab),
  )
  const ActiveIcon = TAB_ICONS[activeIndex % TAB_ICONS.length]

  return (
    <section className={cn("overflow-hidden bg-background", className)}>
      {/* max-w-5xl matches the marketing header, so the hero's border rails line
          up with the header edges instead of sitting ~128px outside them. */}
      <div className="container max-w-5xl">
        <div className="border-x border-border py-12 md:py-20">
          <div className="relative mx-auto max-w-4xl px-6 pt-8 pb-4 lg:p-2">
            <h1 className="mx-auto mt-6 max-w-4xl text-center text-3xl font-bold text-primary tracking-tight text-pretty md:text-4xl lg:text-6xl lg:tracking-tighter">
              {heading}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground md:text-base lg:text-xl">
              {description}
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
              {buttons?.primary && (
                <Button className="w-full sm:w-auto" asChild>
                  <Link href={buttons.primary.url}>{buttons.primary.text}</Link>
                </Button>
              )}
              {buttons?.secondary && (
                <Button className="w-full sm:w-auto" variant="outline" asChild>
                  <Link href={buttons.secondary.url}>{buttons.secondary.text}</Link>
                </Button>
              )}
            </div>
          </div>

          {tabs.length > 0 && (
            <div className="mt-4 md:mt-16 lg:mt-20">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="hidden md:block">
                  <TabsList className="mx-auto mb-6 flex h-auto w-fit flex-wrap justify-center gap-2 p-1 md:gap-2 lg:gap-3">
                    {tabs.map((tab, index) => {
                      const Icon = TAB_ICONS[index % TAB_ICONS.length]

                      return (
                        <TabsTrigger
                          key={tab.title}
                          value={tab.title}
                          className="gap-1.5 px-2 py-1 text-sm font-normal text-muted-foreground lg:gap-2 lg:px-3 lg:py-2 lg:text-base"
                        >
                          <Icon className="size-4 lg:size-5" aria-hidden />
                          {tab.title}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </div>

                <div className="relative isolate">
                  <div className="relative z-10">
                    {tabs.map((tab, index) => (
                      <TabsContent
                        key={tab.title}
                        value={tab.title}
                        // Radix unmounts inactive content, so only the active
                        // panel ever renders — the previous `opacity-0` branch
                        // was unreachable and no fade happened. Animating the
                        // panel on mount is what actually reads as a crossfade.
                        className="animate-in fade-in relative -mx-px bg-background duration-500"
                      >
                        <Image
                          src={tab.image.src}
                          alt={tab.image.alt}
                          width={1600}
                          height={1000}
                          // The first tab's image is the LCP element on the
                          // marketing page; the rest load on demand.
                          priority={index === 0}
                          sizes="(min-width: 1280px) 1232px, 100vw"
                          className="aspect-[16/10] w-full border border-border object-top shadow-[0_6px_20px_rgb(0,0,0,0.12)]"
                        />
                        <BorderBeam duration={8} size={100} />
                      </TabsContent>
                    ))}
                  </div>

                  <span className="absolute -inset-x-1/5 top-0 -z-10 h-px bg-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                  <span className="absolute -inset-x-1/5 bottom-0 -z-10 h-px bg-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                  <span className="absolute -inset-x-1/5 top-12 h-px border-t border-dashed border-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                  <span className="absolute -inset-x-1/5 bottom-12 h-px border-t border-dashed border-border [mask-image:linear-gradient(to_right,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                  <span className="absolute -inset-y-1/5 left-1/6 w-px border-r border-dashed border-border [mask-image:linear-gradient(to_bottom,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                  <span className="absolute -inset-y-1/5 right-1/6 w-px border-r border-dashed border-border [mask-image:linear-gradient(to_bottom,transparent_1%,black_10%,black_90%,transparent_99%)]" />
                </div>

                <nav
                  className="mt-6 flex flex-col items-center gap-4 md:hidden"
                  aria-label="Feature slides"
                >
                  {/* Deliberately not role="tablist": these dots aren't wired to
                      the Radix tabpanel via aria-controls, and claiming the tab
                      role without that association describes a relationship to
                      screen readers that doesn't exist. */}
                  <div className="flex items-center gap-1.5">
                    {tabs.map((tab) => (
                      <button
                        key={tab.title}
                        type="button"
                        aria-current={activeTab === tab.title}
                        aria-label={tab.title}
                        onClick={() => setActiveTab(tab.title)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          activeTab === tab.title
                            ? "w-8 bg-foreground"
                            : "w-1.5 bg-muted-foreground/40",
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                    <ActiveIcon
                      key={activeTab}
                      className="size-5 text-foreground"
                      aria-hidden
                    />
                  </div>
                </nav>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export { Hero }
