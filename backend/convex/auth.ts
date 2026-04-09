import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import Google from "@auth/core/providers/google";

const isAnonymousAuthEnabled =
  process.env.ANONYMOUS_AUTH_ENABLED === "true";

const providers = isAnonymousAuthEnabled
  ? [Google, Anonymous]
  : [Google];

export const { auth, signIn, signOut, store } = convexAuth({
  providers,
});