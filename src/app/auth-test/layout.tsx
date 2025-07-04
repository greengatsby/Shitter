import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Org Flow TEST page (Beta)",
  description: "Org Flow (Beta)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
        {children}
    </>
  );
}
