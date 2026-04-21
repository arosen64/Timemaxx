import LandingHeroPanel from "../components/landing/LandingHeroPanel";
import LandingLoginCard from "../components/landing/LandingLoginCard";

export default function LandingPage() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full font-body">
      <LandingHeroPanel />
      <LandingLoginCard />
    </div>
  );
}
