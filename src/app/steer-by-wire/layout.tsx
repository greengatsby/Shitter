import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Steer by Wire",
  description: "Steer by Wire",
};

export default function SteerByWireLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <>{children}</>
    );
  }