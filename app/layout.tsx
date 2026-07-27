import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silly Goose MVP — Garden planning for the Western Cape",
  description:
    "Turn your garden’s conditions into a suitable plant shortlist, with a measured planting plan coming next.",
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
      "A garden design shaped by place.",
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
