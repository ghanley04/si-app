import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-sista-plum">
          Your SI leader, on demand.
        </h1>
        <p className="text-lg text-sista-muted">
          Upload your course&apos;s lecture notes and past materials, then ask
          questions or generate SI-style practice sessions grounded in exactly
          what your professor covers.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-sista-plum px-5 py-2.5 text-sm font-medium text-white hover:bg-sista-coral"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-sista-border px-5 py-2.5 text-sm font-medium text-sista-plum hover:bg-sista-cream/60"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
