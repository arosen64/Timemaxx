# Auth Reference

Detailed patterns and code examples for the authentication system.

---

## Backend: Provider Registration

`convex/auth.ts` — the single source of truth for available auth providers:

```typescript
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { validatePasswordRequirements } from "./password_validation";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Anonymous,
    Password<DataModel>({
      verify: ResendOTP,
      reset: ResendOTPPasswordReset,
      validatePasswordRequirements,
    }),
  ],
});
```

The `Anonymous` provider enables guest access. The `Password` provider enables email/password sign-in/sign-up with email verification (via `verify`) and password reset (via `reset`). The `validatePasswordRequirements` function enforces strong passwords in production. OTP codes are 8-digit numeric, with 20-minute expiry, sent via Resend.

---

## Backend: Auth Wrappers

`convex/lib.ts` provides auth-enforcing function wrappers:

```typescript
export const queryWithAuth = customQuery(baseQuery, {
  args: {},
  input: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return { ctx: { userId }, args: {} };
  },
});
```

`mutationWithAuth` and `actionWithAuth` follow the same pattern. All inject `ctx.userId` of type `Id<"users">` into the handler context.

---

## Frontend: App Routing

`src/App.tsx` uses Convex's auth-aware components to route between the auth page and the main app:

```typescript
<AuthLoading>
  {/* shown while checking session */}
</AuthLoading>
<Unauthenticated>
  <AuthPage />
</Unauthenticated>
<Authenticated>
  <MainApp />
</Authenticated>
```

Unauthenticated users see the auth page. Authenticated users see the main app.

---

## Frontend: useAuth Hook

`src/auth/hooks/use-auth.ts` — manages authentication state, multi-step flow, and actions:

```typescript
export function useAuth() {
  const { signIn } = useAuthActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<AuthStep>("signIn");

  const handleAuth = async (flow, email, password) => {
    /* ... setStep({ email }) on success */
  };
  const handleVerifyCode = async (email, code) => {
    /* flow: "email-verification" */
  };
  const handleRequestPasswordReset = async (email) => {
    /* flow: "reset", returns email|null */
  };
  const handleResetPassword = async (email, code, newPassword) => {
    /* flow: "reset-verification" */
  };
  const handleAnonymousSignIn = async () => {
    /* signIn("anonymous") */
  };

  return {
    handleAuth,
    handleVerifyCode,
    handleRequestPasswordReset,
    handleResetPassword,
    handleAnonymousSignIn,
    isSubmitting,
    step,
    setStep,
  };
}
```

The `step` state drives which form the auth page shows: `"signIn"` → AuthForm, `{ email }` → VerifyCodeForm, `"forgot"` → ForgotPasswordForm.

Sign-out is handled separately — `SignOutButton` in `src/layout/header.tsx` calls `useAuthActions().signOut()` directly.

---

## Frontend: Form Validation

`src/auth/types/auth.ts`:

```typescript
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignInData = z.infer<typeof signInSchema>;
export type AuthFlow = "signIn" | "signUp";
export type AuthStep = "signIn" | { email: string } | "forgot";
```

`AuthForm` validates against `signInSchema` before calling `onSubmit`. Validation errors are shown inline.

---

## Frontend: AuthForm Component

`src/auth/components/auth-form.tsx` — tabbed form with sign-in and sign-up:

- Tabs switch between "Sign In" and "Sign Up" (sets the `flow` field)
- Email input with type `email`
- Password input with `autocomplete` switching:
  - `"current-password"` for sign-in
  - `"new-password"` for sign-up
- "Forgot password?" link visible only on sign-in tab
- Password strength hints checklist visible only on sign-up tab when password is non-empty
- Submit button disabled while `isSubmitting` is true
- Props: `onSubmit: (flow, email, password) => void`, `onForgotPassword: () => void`, and `isSubmitting: boolean`

---

## Testing Auth

### Hook tests (`src/auth/hooks/__tests__/use-auth.test.ts`):

Mock `@convex-dev/auth/react` and `sonner`:

```typescript
const mockSignIn = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));
```

Test categories:

- Error mapping (all `friendlyAuthError` branches, including `ConvexError` for `INVALID_PASSWORD`)
- `handleAuth` form data construction and step transitions
- `handleVerifyCode` with email-verification flow
- `handleRequestPasswordReset` with reset flow
- `handleResetPassword` with reset-verification flow
- `handleAnonymousSignIn` provider call
- `isSubmitting` state transitions (before, during, after)
- `step` state management

### Component tests (`src/auth/components/__tests__/auth-form.test.tsx`):

- Form rendering with correct fields
- Tab switching between sign-in/sign-up
- Validation error display
- Form submission with correct arguments
- Disabled state during submission
- Forgot password link visibility (sign-in only)
- Forgot password link click handler
- Password strength hints during sign-up

### Backend tests (`convex/users.test.ts`):

- Unauthenticated access rejected
- `getMe` returns user data
- `updateMe` persists changes
- User isolation (one user's data doesn't leak to another)
