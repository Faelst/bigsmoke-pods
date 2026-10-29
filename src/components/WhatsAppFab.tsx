"use client";

import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

export function WhatsAppFab() {
  // Na página de produto existe uma barra fixa de compra no mobile: sobe o botão.
  const onProduct = usePathname().startsWith("/produto/");
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className={`fixed ${onProduct ? "bottom-40" : "bottom-24"} right-4 z-30 grid size-14 animate-pulse-ring place-items-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6`}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
