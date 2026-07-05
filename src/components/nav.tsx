import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="flex items-center justify-between bg-sista-plum px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/brand/sista-icon.svg" alt="" width={32} height={32} />
        <span className="text-lg font-semibold">
          <span className="text-white">SI</span>
          <span className="text-sista-gold">sta</span>
        </span>
      </Link>
      <div className="flex items-center gap-4 text-sm text-white">
        {user ? (
          <>
            <span className="text-xs text-sista-cream">{user.email}</span>
            <Link href="/courses" className="hover:text-sista-gold hover:underline">
              Courses
            </Link>
            <form action={signOut}>
              <button type="submit" className="hover:text-sista-gold hover:underline">
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-sista-gold hover:underline">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-sista-gold px-3 py-1.5 text-sista-charcoal hover:bg-sista-cream"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
