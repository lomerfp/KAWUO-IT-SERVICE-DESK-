import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAWUO IT Service Desk",
  description: "Submit and track IT requests at KAWUO.",
  icons: {
    icon: "/kawuo-logo.png",
    shortcut: "/kawuo-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
