import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "WareAgent — Retail Operations",
    template: "%s | WareAgent",
  },
  description:
    "AI-powered multi-store retail inventory management. Prediction-driven shortage detection, autonomous agent negotiation, and transfer management.",
  keywords: ["retail", "inventory", "AI agents", "supply chain", "stock management"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
