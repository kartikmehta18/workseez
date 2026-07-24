import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Workseez — Client Portal",
  description:
    "A single portal to share projects, track progress, and keep every client conversation moving.",
};

export default function RootLayout({ children }) {
  return (
    // data-scroll-behavior opts the smooth scrolling set in globals.css out of
    // route transitions — without it Next.js animates the scroll reset between
    // pages, so a navigation visibly glides to the top instead of starting there.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* The marketing Navbar is rendered per-page, not here — the dashboard
          has its own sidebar shell and must not inherit the public header. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
