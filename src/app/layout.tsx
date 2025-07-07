import type { Metadata } from "next";
// import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/useAuth";

// const inter = Inter({
//   variable: "--font-sans",
//   subsets: ["latin"],
// });

// const jetbrainsMono = JetBrains_Mono({
//   variable: "--font-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Org Flow (Beta)",
  description: "Org Flow (Beta)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
