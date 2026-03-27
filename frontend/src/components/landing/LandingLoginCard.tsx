import { useAuthActions } from "@convex-dev/auth/react";
import { GoogleIcon } from "../icons";

export default function LandingLoginCard() {
  const { signIn } = useAuthActions();

  return (
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
  );
}
