import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/inbox/:path*", "/trends/:path*", "/ask/:path*", "/reports/:path*", "/settings/:path*"],
};
