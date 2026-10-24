import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  appName: "MOTORNA",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.authRateLimits,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "MOTORNA — إعادة تعيين كلمة المرور / Reset your password",
        text: `افتح الرابط لتعيين كلمة مرور جديدة (صالح ٣٠ دقيقة):\nOpen this link to set a new password (valid 30 minutes):\n${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "user" },
      phone: { type: "string", input: false, required: false },
      showPhone: { type: "boolean", input: false, defaultValue: false },
      locale: { type: "string", input: false, defaultValue: "ar" },
      suspendedAt: { type: "date", input: false, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/reset-password": { window: 60 * 10, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [u] = await db
            .select({ suspendedAt: schema.users.suspendedAt })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId));
          if (u?.suspendedAt) return false;
        },
      },
    },
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
