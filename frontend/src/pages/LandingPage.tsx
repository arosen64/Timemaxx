import { useAuthActions } from "@convex-dev/auth/react";
import { GoogleIcon } from '../components/icons/icons';
import BrandLogo from '../components/ui/BrandLogo';

export default function LandingPage() {

  const { signIn } = useAuthActions(); 

  return (
    <div className="flex min-h-screen w-full font-body">
      {/* Left: Hero Panel */}
      <div className="flex w-1/2 flex-col justify-between bg-navy px-16 py-20">
        {/* Top: Logo + Headline */}
        <div className="flex flex-col gap-10">
          {/* Logo Row */}
          <BrandLogo size="md" />

          {/* Headline */}
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

        {/* Middle: Feature List */}
        <div className="flex flex-col gap-4">
          {[
            "Gemini-powered time estimation",
            "Personalized daily study windows",
            "Smart scheduling around your life",
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-teal" />
              <span className="text-sm text-white">{feat}</span>
            </div>
          ))}
        </div>

        {/* Bottom: JHU Badge */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 flex-shrink-0 bg-teal" />
          <span className="text-xs leading-tight text-sky-blue">
            Johns Hopkins University<br />Timemaxx
          </span>
        </div>
      </div>

      {/* Right: Login Panel */}
      <div className="flex w-1/2 items-center justify-center bg-bg-gray">
        <div className="flex w-[440px] flex-col gap-8 rounded-xl border border-border bg-white p-12">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-bold text-navy">
              Welcome back
            </h2>
            <p className="text-sm leading-relaxed text-slate-blue">
              Sign in to access your personalized study dashboard.
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={() => signIn("google")}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-navy font-heading text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <p className="text-xs leading-relaxed text-light-blue">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

