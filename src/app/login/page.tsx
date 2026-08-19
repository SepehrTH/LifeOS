import { redirect } from "next/navigation";
import { currentUser, signIn } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account is not allowed to sign in here.",
  Configuration: "Google sign-in is not configured yet. Check your .env.local.",
  OAuthSignin: "Could not reach Google. Try again.",
  OAuthCallback: "Google sign-in failed. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/home");

  const { error } = await searchParams;
  const configured = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-mark">OS</div>
        <p className="login-sub">Your personal system.</p>

        {!configured ? (
          <p className="login-err">
            Google sign-in isn&rsquo;t configured yet. Add AUTH_GOOGLE_ID and
            AUTH_GOOGLE_SECRET to <code>.env.local</code> — see the README.
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/home" });
          }}
        >
          <button className="login-btn" type="submit" disabled={!configured}>
            <GoogleMark />
            Continue with Google
          </button>
        </form>

        {error ? (
          <p className="login-err">{ERRORS[error] ?? "Sign-in failed. Try again."}</p>
        ) : null}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C37.1 40.2 44 35 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
