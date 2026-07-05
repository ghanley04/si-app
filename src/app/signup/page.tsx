import Link from "next/link";
import { signUp } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verify?: string }>;
}) {
  const { error, verify } = await searchParams;

  if (verify) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-sista-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-sista-plum">Check your email</h1>
          <p className="text-sm text-sista-muted">
            We&apos;ve sent you a verification link. You&apos;ll need to confirm
            your email address before you can log in.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral"
          >
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={signUp} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-sista-plum">Sign up</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="fullName">
            Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            className="w-full rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
        </div>
        <p className="text-xs text-sista-muted">
          You&apos;ll need to verify your email address before you can log in.
        </p>
        <button
          type="submit"
          className="w-full rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral"
        >
          Create account
        </button>
        <p className="text-sm text-sista-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-sista-plum underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
