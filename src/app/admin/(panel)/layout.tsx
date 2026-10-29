import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <AdminNav />
      </Suspense>
      <main className="flex-1 px-4 pb-28 pt-5 lg:ml-60 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </>
  );
}
