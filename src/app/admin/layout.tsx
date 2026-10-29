import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin Big Smoke" }, robots: { index: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
