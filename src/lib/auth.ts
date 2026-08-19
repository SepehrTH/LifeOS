import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db, uid } from "./db";

/** Optional allow-list so only your own Google account(s) can sign in. */
const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      if (allowed.length > 0 && !allowed.includes(email)) return false;
      return true;
    },
    async jwt({ token, profile }) {
      const email = (profile?.email ?? token.email)?.toLowerCase();
      if (!email) return token;

      const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
        | { id: string }
        | undefined;

      if (row) {
        token.uid = row.id;
      } else {
        const id = uid();
        db.prepare(
          "INSERT INTO users (id, email, name, image) VALUES (?, ?, ?, ?)"
        ).run(id, email, (profile?.name as string) ?? null, (profile?.picture as string) ?? null);
        token.uid = id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Local development escape hatch: set OS_DEV_EMAIL in .env.local to work on the UI
 * without Google credentials. Ignored in production builds.
 */
function devUser(): AppUser | null {
  const email = process.env.OS_DEV_EMAIL?.toLowerCase();
  if (!email || process.env.NODE_ENV === "production") return null;

  const row = db.prepare("SELECT id, email, name, image FROM users WHERE email = ?").get(email) as
    | AppUser
    | undefined;
  if (row) return row;

  const id = uid();
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(id, email, "Dev");
  return { id, email, name: "Dev", image: null };
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<AppUser | null> {
  const dev = devUser();
  if (dev) return dev;

  /* auth() throws when Google credentials are missing; treat that as signed out. */
  const session = await auth().catch(() => null);
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

/** Returns the signed-in user's row id, or null. */
export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}
