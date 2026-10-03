"use client";
import { signOut } from "next-auth/react";
export default function SignOutButton() { return <button className="text-rose-400" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>; }
