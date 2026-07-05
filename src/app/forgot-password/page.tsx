import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-sista-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-sista-plum">Check your email</h1>
          <p className="text-sm text-sista-muted">
            If an account exists for that email, we&apos;ve sent a link to reset
            your password.
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
      <form action={requestPasswordReset} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-sista-plum">Forgot password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
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
        <button
          type="submit"
          className="w-full rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral"
        >
          Send reset link
        </button>
        <p className="text-sm text-sista-muted">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-sista-plum underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
