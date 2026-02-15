import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClawSight — The Control Panel for Your AI Agent",
  description:
    "Give her a name, teach her skills, watch her work. The GUI layer for OpenClaw.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
