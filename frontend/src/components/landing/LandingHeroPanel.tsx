import BrandLogo from "./BrandLogo";

const FEATURES = [
  "AI-powered time estimation",
  "Personalized daily study windows",
  "Smart scheduling around your life",
];

export default function LandingHeroPanel() {
  return (
    <div className="flex w-full md:w-1/2 flex-col justify-between bg-navy px-8 py-10 md:px-16 md:py-20">
      <div className="flex flex-col gap-10">
        <BrandLogo />
        <div className="flex flex-col gap-4">
          <h1 className="font-heading text-5xl font-bold leading-tight text-white">
            Study smarter,<br />not harder.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-sky-blue">
            AI-powered scheduling that estimates your task time and builds a
            personalized study plan around your life.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {FEATURES.map((feat) => (
          <div key={feat} className="flex items-center gap-3">
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-teal" />
            <span className="text-sm text-white">{feat}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="h-8 w-1 flex-shrink-0 bg-teal" />
        <span className="text-xs leading-tight text-sky-blue">
          Johns Hopkins University<br />Timemaxx
        </span>
      </div>
    </div>
  );
}
