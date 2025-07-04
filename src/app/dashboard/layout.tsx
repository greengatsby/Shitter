import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Org Flow Dashboard (Beta)",
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
