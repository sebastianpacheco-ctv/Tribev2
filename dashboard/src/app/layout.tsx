import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRIBE v2 | Predictive Creative Diagnostics",
  description: "Next-generation brain-inspired predictive foundation model for creative optimization.",
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
