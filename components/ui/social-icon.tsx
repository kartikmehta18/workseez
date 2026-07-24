import {
  SiBehance,
  SiDiscord,
  SiDribbble,
  SiFacebook,
  SiGithub,
  SiInstagram,
  SiMedium,
  SiPinterest,
  SiReddit,
  SiSnapchat,
  SiSpotify,
  SiSubstack,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiTwitch,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from "@icons-pack/react-simple-icons"
import { Globe } from "lucide-react"

type IconComponent = React.ComponentType<{ className?: string }>

/**
 * Hostname → brand mark. Rendered in `currentColor` rather than brand colours
 * so a row of link chips reads as one set; the Google Drive button stays full
 * colour because it's a distinct, primary action.
 *
 * Note: there is deliberately no LinkedIn entry — Simple Icons removed the
 * LinkedIn logo from the project, so it falls through to the globe.
 */
const BY_HOST: Record<string, IconComponent> = {
  "instagram.com": SiInstagram,
  "youtube.com": SiYoutube,
  "youtu.be": SiYoutube,
  "x.com": SiX,
  "twitter.com": SiX,
  "facebook.com": SiFacebook,
  "fb.com": SiFacebook,
  "tiktok.com": SiTiktok,
  "threads.net": SiThreads,
  "threads.com": SiThreads,
  "pinterest.com": SiPinterest,
  "spotify.com": SiSpotify,
  "github.com": SiGithub,
  "behance.net": SiBehance,
  "dribbble.com": SiDribbble,
  "snapchat.com": SiSnapchat,
  "whatsapp.com": SiWhatsapp,
  "wa.me": SiWhatsapp,
  "t.me": SiTelegram,
  "telegram.org": SiTelegram,
  "reddit.com": SiReddit,
  "discord.com": SiDiscord,
  "discord.gg": SiDiscord,
  "twitch.tv": SiTwitch,
  "medium.com": SiMedium,
  "substack.com": SiSubstack,
}

/** Resolves the brand icon for a URL, falling back to a generic globe. */
export function socialIconFor(url: string): IconComponent {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    if (BY_HOST[host]) return BY_HOST[host]

    // Match subdomains too, so "music.youtube.com" still resolves.
    const match = Object.keys(BY_HOST).find((known) => host.endsWith(`.${known}`))
    return match ? BY_HOST[match] : Globe
  } catch {
    return Globe
  }
}

export function SocialIcon({ url, className }: { url: string; className?: string }) {
  // socialIconFor only *selects* from BY_HOST — every branch returns a
  // module-scope component, so the element type is stable across renders and
  // React never remounts. The lint rule cannot see that and assumes the
  // component is being constructed here.
  const Icon = socialIconFor(url)
  // eslint-disable-next-line react-hooks/static-components
  return <Icon className={className} />
}
