import type { Metadata } from "next";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silly Goose MVP — Garden planning for the Western Cape",
  description:
    "Find Western Cape plants that suit your garden, then see a simple planting plan.",
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
      "Describe your garden. Discover the plants that fit.",
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
