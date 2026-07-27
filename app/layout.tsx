import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silly Goose MVP — A Western Cape garden guide",
  description:
    "Find indigenous Western Cape plants matched to your garden’s light, water, space and intentions.",
  applicationName: "Silly Goose MVP",
  keywords: [
    "Western Cape",
    "indigenous plants",
    "fynbos garden",
    "South African gardening",
  ],
  openGraph: {
    title: "Silly Goose MVP",
    description:
      "A considered starting point for an indigenous Western Cape garden.",
    type: "website",
  },
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

