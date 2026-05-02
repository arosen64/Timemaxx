import { useAuthActions } from "@convex-dev/auth/react";
import { GoogleIcon } from "../icons";

export default function LandingLoginCard() {
  const { signIn } = useAuthActions();

  return (
    <div className="flex w-full md:w-1/2 items-center justify-center bg-bg-gray py-12 px-6 md:px-0">
      <div className="flex w-full max-w-[440px] flex-col gap-8 rounded-xl border border-border bg-white p-8 md:p-12">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl font-bold text-navy">Welcome back</h2>
          <p className="text-sm leading-relaxed text-slate-blue">
            Sign in to access your personalized study dashboard.
          </p>
        </div>

        <button
          onClick={() => signIn("google")}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-navy font-heading text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        {(import.meta.env.DEV || import.meta.env.VITE_ANONYMOUS_AUTH_ENABLED === "true") && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-slate-blue">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              onClick={() => signIn("anonymous")}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white font-heading text-sm font-semibold text-navy transition hover:bg-bg-gray focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Continue as Guest
            </button>
          </>
        )}

        <p className="text-xs leading-relaxed text-light-blue">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
