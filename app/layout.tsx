import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payflow Agent | Get paid on Celo",
  description:
    "An onchain invoice and payment agent for global freelancers, powered by Celo stablecoins.",
  icons: {
    icon: [
      { url: "/payflow-icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-icon.png",
  },
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
