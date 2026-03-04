export default function LandingPage() {
  function handleGoogleSignIn() {
    console.log("Google Sign In clicked")
  }

  return (
    <div className="flex min-h-screen w-full font-body">
      {/* Left: Hero Panel */}
      <div className="flex w-1/2 flex-col justify-between bg-navy px-16 py-20">
        {/* Top: Logo + Headline */}
        <div className="flex flex-col gap-10">
          {/* Logo Row */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-teal">
              <BookOpenIcon />
            </div>
            <span className="font-heading text-xl font-bold text-white">
              Timemaxx
            </span>
          </div>

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
            onClick={handleGoogleSignIn}
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

function BookOpenIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#002D72"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}
