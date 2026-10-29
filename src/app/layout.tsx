import type { Metadata, Viewport } from "next";
import { Bungee, Outfit } from "next/font/google";
import "./globals.css";

const display = Bungee({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const body = Outfit({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Big Smoke Pods", template: "%s | Big Smoke Pods" },
  description: "Os melhores pods: Elfbar, Ignite e muito mais. Pague com PIX ou cartão.",
  icons: { icon: "/brand/logo.png", apple: "/brand/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
