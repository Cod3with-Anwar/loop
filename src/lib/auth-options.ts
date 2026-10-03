import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [CredentialsProvider({
    name: "Credentials",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      if (!email || !credentials?.password) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, role: user.role, workspaceId: user.workspaceId };
    },
  })],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const appUser = user as typeof user & { role: string; workspaceId: string };
        token.role = appUser.role;
        token.workspaceId = appUser.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = typeof token.role === "string" ? token.role : "VIEWER";
        session.user.workspaceId = typeof token.workspaceId === "string" ? token.workspaceId : "";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
