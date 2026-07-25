import { FeatureSection } from "./_components/FeatureSection"
import { Footer } from "./_components/Footer"
import { Hero } from "./_components/Hero"
import { Navbar } from "./_components/Navbar"

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <FeatureSection />
      <Footer />
    </>
  )
}
