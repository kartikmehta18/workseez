"use client" // Tracks the pointer to light up the glyph edges under the cursor.

import { useId, useRef, type PointerEvent, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** How many stacked copies of the glyph form the extruded body, and how far
 *  apart (in screen px) each sits. Together they set the depth: 28 × 3.5 ≈ 98px. */
const LAYER_COUNT = 28
const LAYER_STEP = 3.5

/** Projects the glyph onto the isometric ground plane:
 *  x' = (x − y)·cos30, y' = (x + y)·sin30. */
const ISOMETRIC = "matrix(0.866 0.5 -0.866 0.5 0 0)"

const VIEW_W = 720
const VIEW_H = 520
/** Radius of the pointer spotlight, in viewBox units. */
const SPOT_R = 185

/**
 * The status code as an extruded isometric solid. There is no mesh here — the
 * body is the same `<text>` stamped {@link LAYER_COUNT} times down the screen,
 * each copy filled with the page background so it occludes the one behind it.
 * What's left visible are the stacked outlines, which read as the side faces.
 *
 * The whole stack is then drawn a second time in the brand gradient, masked to
 * a soft disc that follows the cursor — so hovering paints the edges in colour.
 * The mask circle is moved by ref rather than state: a pointermove that
 * re-rendered ~56 `<text>` nodes would stutter.
 */
function IsometricCode({ code }: { code: string }) {
  const uid = useId().replace(/:/g, "")
  const edgeId = `${uid}-edge`
  const glowId = `${uid}-glow`
  const spotId = `${uid}-spot`
  const maskId = `${uid}-mask`

  const svgRef = useRef<SVGSVGElement>(null)
  const spotRef = useRef<SVGCircleElement>(null)

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    const spot = spotRef.current
    if (!svg || !spot) return

    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    spot.setAttribute("cx", `${((event.clientX - rect.left) / rect.width) * VIEW_W}`)
    spot.setAttribute("cy", `${((event.clientY - rect.top) / rect.height) * VIEW_H}`)
  }

  // Back-to-front, so the top face is painted last and stays unoccluded.
  const layers = Array.from({ length: LAYER_COUNT }, (_, i) => LAYER_COUNT - 1 - i)

  const stack = (mode: "body" | "highlight") =>
    layers.map((layer) => {
      const isTopFace = layer === 0
      const stroke =
        mode === "highlight" || isTopFace ? `url(#${edgeId})` : "currentColor"

      return (
        <g key={layer} transform={`translate(0 ${layer * LAYER_STEP})`}>
          <text
            transform={ISOMETRIC}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-geist-sans), sans-serif"
            fontSize={230}
            fontWeight={700}
            letterSpacing={8}
            fill="var(--background)"
            stroke={stroke}
            strokeOpacity={mode === "highlight" ? 0.95 : isTopFace ? 1 : 0.07}
            strokeWidth={isTopFace || mode === "highlight" ? 1.6 : 1}
            vectorEffect="non-scaling-stroke"
          >
            {code}
          </text>
        </g>
      )
    })

  return (
    <svg
      ref={svgRef}
      onPointerMove={handlePointerMove}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={code}
      className="text-foreground group w-full max-w-2xl"
    >
      <defs>
        <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gradient-1)" />
          <stop offset="55%" stopColor="var(--gradient-3)" />
          <stop offset="100%" stopColor="var(--gradient-2)" />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--gradient-3)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--gradient-3)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={spotId}>
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <circle
            ref={spotRef}
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            r={SPOT_R}
            fill={`url(#${spotId})`}
          />
        </mask>
      </defs>

      <ellipse cx="360" cy="290" rx="310" ry="185" fill={`url(#${glowId})`} />

      <g transform="translate(360 200)">{stack("body")}</g>

      <g
        mask={`url(#${maskId})`}
        className="opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
      >
        <g transform="translate(360 200)">{stack("highlight")}</g>
      </g>
    </svg>
  )
}

/** Isometric triangle grid — lines at ±30° plus verticals, faded out at the
 *  edges so it never competes with the copy. Vertical spacing is 64/cos30 so
 *  the three families actually meet at shared vertices. */
function IsometricGrid() {
  const fade = "radial-gradient(ellipse 75% 65% at 42% 45%, #000 0%, transparent 100%)"

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-70"
      style={{
        backgroundImage: [
          "repeating-linear-gradient(60deg, var(--border) 0 1px, transparent 1px 64px)",
          "repeating-linear-gradient(120deg, var(--border) 0 1px, transparent 1px 64px)",
          "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 74px)",
        ].join(","),
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    />
  )
}

export function ErrorScreen({
  code,
  title,
  description,
  actions,
  footnote,
  className,
}: {
  code: string
  title: string
  description: ReactNode
  actions?: ReactNode
  footnote?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "relative isolate flex min-h-[85vh] w-full items-center overflow-hidden px-6 py-12",
        className
      )}
    >
      <IsometricGrid />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-2 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="animate-fade-in flex justify-center lg:justify-end">
          <IsometricCode code={code} />
        </div>
        <div className="animate-fade-in max-w-md text-center lg:text-left">
          <p className="text-muted-foreground font-mono text-sm tracking-widest">
            {code}
          </p>
          <h1 className="text-foreground mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <div className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {description}
          </div>
          {actions ? (
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
              {actions}
            </div>
          ) : null}
          {footnote ? (
            <p className="text-muted-foreground mt-6 font-mono text-xs">{footnote}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
