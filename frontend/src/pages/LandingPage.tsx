import { colors, fonts } from '../styles/tokens'

export default function LandingPage() {
  function handleGoogleSignIn() {
    // TODO: wire up Convex Auth Google OAuth (issue #20)
    console.log("Google Sign In clicked")
  }

  return (
    <div className="flex min-h-screen w-full" style={{ fontFamily: fonts.body }}>
      {/* Left: Hero Panel */}
      <div
        className="flex w-1/2 flex-col justify-between"
        style={{ backgroundColor: colors.navy, padding: "80px 72px" }}
      >
        {/* Top: Logo + Headline */}
        <div className="flex flex-col gap-10">
          {/* Logo Row */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded"
              style={{ width: 40, height: 40, backgroundColor: colors.teal }}
            >
              <BookOpenIcon />
            </div>
            <span
              className="font-bold text-white"
              style={{ fontFamily: fonts.heading, fontSize: 22 }}
            >
              Timemaxx
            </span>
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-4">
            <h1
              className="font-bold text-white"
              style={{ fontFamily: fonts.heading, fontSize: 52, lineHeight: 1.15 }}
            >
              Study smarter,<br />not harder.
            </h1>
            <p style={{ color: colors.skyBlue, fontSize: 17, lineHeight: 1.6, maxWidth: 480 }}>
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
              <div
                className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, backgroundColor: colors.teal }}
              />
              <span className="text-white" style={{ fontSize: 15 }}>
                {feat}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom: JHU Badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex-shrink-0"
            style={{ width: 3, height: 32, backgroundColor: colors.teal }}
          />
          <span style={{ color: colors.skyBlue, fontSize: 12, lineHeight: 1.4 }}>
            Johns Hopkins University<br />Study Scheduler
          </span>
        </div>
      </div>

      {/* Right: Login Panel */}
      <div
        className="flex w-1/2 items-center justify-center"
        style={{ backgroundColor: colors.bgGray }}
      >
        <div
          className="flex flex-col gap-8 bg-white"
          style={{
            width: 440,
            padding: 48,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
          }}
        >
          <div className="flex flex-col gap-2">
            <h2
              className="font-bold"
              style={{ fontFamily: fonts.heading, fontSize: 28, color: colors.navy }}
            >
              Welcome back
            </h2>
            <p style={{ color: colors.slateBlue, fontSize: 15, lineHeight: 1.5 }}>
              Sign in to access your personalized study dashboard.
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: colors.navy,
              height: 52,
              borderRadius: 8,
              fontFamily: fonts.heading,
              fontSize: 15,
            }}
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <p style={{ color: colors.lightBlue, fontSize: 12, lineHeight: 1.5 }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function BookOpenIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={colors.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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