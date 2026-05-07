import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuralSeed | Predictive Creative Diagnostics",
  description: "Seedtag's brain-inspired predictive engine for CTV creative optimization.",
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
