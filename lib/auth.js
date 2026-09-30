import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";

// Comma-separated list of allowed suffixes, e.g. "@blackdogadvertising.com,someone@gmail.com"
const allowedSuffixes = (process.env.EMAIL_WHITELIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const isAllowedEmail = (email) =>
  Boolean(email) && allowedSuffixes.some((suffix) => email.toLowerCase().endsWith(suffix));

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  // Stateless JWT sessions: no session lookup in Mongo on every request, and no
  // adapter package to keep in step with the Mongo driver.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.SECRET,
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      return Boolean(profile?.email_verified) && isAllowedEmail(profile.email);
    },
  },
};

/**
 * Server-side session lookup for API routes and getServerSideProps. The result
 * is JSON-safe (no `undefined` fields) so it can go straight into page props.
 */
export async function getSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  return session ? JSON.parse(JSON.stringify(session)) : null;
}

/**
 * Guard for API routes. Returns the session, or writes a 401 and returns null so
 * the caller can simply `if (!session) return;`.
 */
export async function requireSession(req, res) {
  const session = await getSession(req, res);
  if (!session?.user?.email || !isAllowedEmail(session.user.email)) {
    res.status(401).json({ success: false, message: "Sign in to continue." });
    return null;
  }
  return session;
}
