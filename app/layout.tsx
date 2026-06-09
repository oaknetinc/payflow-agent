import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payflow Agent | Get paid on Celo",
  description:
    "An onchain invoice and payment agent for global freelancers, powered by Celo stablecoins.",
  icons: { icon: "/logo.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
