import { Suspense } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { AgeGate } from "@/components/AgeGate";
import { Footer } from "@/components/Footer";
import { StoreClosedBanner } from "@/components/StoreClosedBanner";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <StoreClosedBanner />
      <main className="flex-1">{children}</main>
      <Footer />
      <Suspense>
        <BottomNav />
      </Suspense>
      <CartDrawer />
      <Suspense>
        <WhatsAppFab />
      </Suspense>
      <AgeGate />
    </>
  );
}
