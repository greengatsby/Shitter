"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RedirectHandler({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      // Redirect to the specified URL
      window.location.href = "http://31.97.10.68:3000/auth/signin";
    }
  }, [searchParams, router]);

  return <>{children}</>;
} 