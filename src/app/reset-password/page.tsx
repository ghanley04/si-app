import { updatePassword } from "@/app/auth/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form action={updatePassword} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-sista-plum">Reset password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="password">
            New password
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
            Confirm new password
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
        <button
          type="submit"
          className="w-full rounded-md bg-sista-plum px-4 py-2 text-sm font-medium text-white hover:bg-sista-coral"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
