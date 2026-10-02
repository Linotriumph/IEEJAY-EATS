import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IEEJAY EATS — API Explorer",
  description:
    "A minimal frontend consumer demonstrating the IEEJAY EATS public REST API. Browse restaurants and menus powered by the live deployed API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
