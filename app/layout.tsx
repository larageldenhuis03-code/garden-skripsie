import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";

export const metadata = {
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
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Silly Goose MVP",
    description:
      "Describe your garden. Discover the plants that fit.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preloaded: it is used by every heading and the header, so a
            late swap would reflow the whole page. */}
        <link
          rel="preload"
          href="/fonts/SillyGooseHand.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
