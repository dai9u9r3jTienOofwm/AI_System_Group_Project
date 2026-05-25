import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "UET AI Chatbot",
  description: "UET AI Chatbot with Spotify Redesign",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-background antialiased text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
