import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AURA — Autonomous Utility Revenue Agent",
  description:
    "A self-sustaining AI agent on Base mainnet that earns more from DeFi yield and x402 service fees than it spends on compute.",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "AURA — Autonomous Utility Revenue Agent",
    description: "Self-sustaining AI agent on Base | Aave yield + x402 payments",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "AURA — Autonomous Utility Revenue Agent",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0e1a] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
