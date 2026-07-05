import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string }>;
}) {
  const { error, verified } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={signIn} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-sista-plum">Log in</h1>
        {verified && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            You verified your email, proceed to login.
          </p>
        )}
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
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-sista-border px-3 py-2 text-sm outline-none focus:border-sista-plum focus:ring-1 focus:ring-sista-plum"
          />
          <Link
            href="/forgot-password"
            className="inline-block text-xs font-medium text-sista-plum underline"
          >
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral"
        >
          Log in
        </button>
        <p className="text-sm text-sista-muted">
          No account?{" "}
          <Link href="/signup" className="font-medium text-sista-plum underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
