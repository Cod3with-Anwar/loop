import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";

const inter = localFont({ src: "./fonts/GeistVF.woff", display: "swap" });

export const metadata: Metadata = {
  title: "LOOP",
  description: "AI-Powered Customer Feedback Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
