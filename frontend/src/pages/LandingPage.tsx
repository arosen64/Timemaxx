import LandingHeroPanel from "../components/landing/LandingHeroPanel";
import LandingLoginCard from "../components/landing/LandingLoginCard";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full font-body">
      <LandingHeroPanel />
      <LandingLoginCard />
    </div>
  );
}
