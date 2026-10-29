"use client";

import Image from "next/image";
import { instagramUrl, SITE, tiktokUrl, whatsappLink } from "@/lib/site";
import { useStoreInfo } from "@/lib/store-info";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "./icons";

export function Footer() {
  const { social } = useStoreInfo();
  return (
    <footer className="mt-20 border-t border-line/60 bg-surface/50 pb-28 pt-10 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo.png" alt={SITE.name} width={56} height={56} className="rounded-2xl" />
          <div>
            <p className="font-display text-lg">BIG <span className="text-leaf">SMOKE</span> PODS</p>
            <p className="text-sm text-muted">Os melhores pods, entregues rapidinho.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={instagramUrl(social.instagram)} target="_blank" rel="noreferrer" className="btn-ghost">
            <InstagramIcon className="size-5 text-[#e1306c]" /> @{social.instagram}
          </a>
          {social.tiktok && (
            <a href={tiktokUrl(social.tiktok)} target="_blank" rel="noreferrer" className="btn-ghost">
              <TikTokIcon className="size-5" /> TikTok
            </a>
          )}
          <a href={whatsappLink(social.whatsapp)} target="_blank" rel="noreferrer" className="btn-ghost">
            <WhatsAppIcon className="size-5 text-[#25D366]" /> WhatsApp
          </a>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-4 text-xs text-muted">
        Venda proibida para menores de 18 anos. Este produto contém nicotina, substância que causa dependência.
        © {SITE.name}
      </p>
    </footer>
  );
}
