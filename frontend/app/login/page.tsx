"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Login route now just redirects to the home landing page
export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
      Redirecting...
    </div>
  );
}
