import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

// ═══════════════════════════════════════════════════════════════
// VALIDATE ENVIRONMENT — fail fast, not silently
// ═══════════════════════════════════════════════════════════════
const requiredEnvVars = ['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.error('[Auth.js] ❌ Missing required environment variables:', missingVars);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[Auth.js] Missing required env vars: ${missingVars.join(', ')}`);
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      profile(profile) {
        let name = profile.name;

        if (!name && (profile.given_name || profile.family_name)) {
          name = `${profile.given_name || ''} ${profile.family_name || ''}`.trim();
        }

        if (!name && profile.email) {
          name = profile.email.split('@')[0];
        }

        return {
          id: profile.sub,
          name: name || 'User',
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      // Fetch user role from Convex on sign-in
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      const email = user.email;

      if (convexUrl && email) {
        try {
          const apiUrl = convexUrl.replace(/\/api$/, '');
          const queryUrl = `${apiUrl}/api/query`;

          const response = await fetch(queryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: 'users.queries.getUserByEmail',
              args: { email },
              format: 'json',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const userData = data.value || data;

            if (userData?.role) {
              user.role = userData.role;
            }
            if (userData?.organizationId) {
              user.organizationId = userData.organizationId;
            }
            if (userData?.isApproved !== undefined) {
              user.isApproved = userData.isApproved;
            }
            if (userData?.organizationId) {
              user.organizationId = userData.organizationId;
            }
            if (userData?.isApproved !== undefined) {
              user.isApproved = userData.isApproved;
            }
          }
        } catch (error) {
          console.error('[Auth.js] Error fetching user role:', error);
        }
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.name = user.name || 'User';
        token.email = user.email;
        token.picture = user.image;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.isApproved = user.isApproved;
      }

      // Refresh role data on explicit update trigger
      if (trigger === 'update' && token.email) {
        try {
          const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
          if (convexUrl) {
            const apiUrl = convexUrl.replace(/\/api$/, '');
            const queryUrl = `${apiUrl}/api/query`;

            const response = await fetch(queryUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: 'users.queries.getUserByEmail',
                args: { email: token.email },
                format: 'json',
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const userData = data.value || data;

              if (userData?.role) token.role = userData.role;
              if (userData?.organizationId) token.organizationId = userData.organizationId;
              if (userData?.isApproved !== undefined) token.isApproved = userData.isApproved;
            }
          }
        } catch (error) {
          console.error('[Auth.js] Error refreshing user role:', error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.email = token.email as string;
      session.user.name = (token.name as string) || token.email?.split('@')[0] || 'User';
      session.user.image = token.picture as string | undefined;
      session.user.role = token.role;
      session.user.organizationId = token.organizationId;
      session.user.isApproved = token.isApproved;

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export const GET = handlers.GET;
export const POST = handlers.POST;
