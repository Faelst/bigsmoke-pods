"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bike, CreditCard, ExternalLink, LayoutDashboard, LogOut, Package, ShoppingCart, Store, Users } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/entrega", label: "Entrega", icon: Bike },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/admin/loja", label: "Loja", icon: Store },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  };
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Desktop: barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-2.5 px-2">
          <Image src="/brand/logo.png" alt="" width={36} height={36} className="rounded-xl" />
          <span className="font-display leading-none">BIG <span className="text-leaf">SMOKE</span><span className="mt-0.5 block text-[10px] tracking-widest text-muted">ADMIN</span></span>
        </Link>
        <nav className="flex flex-col gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive(href) ? "text-black" : "text-muted hover:bg-surface-2 hover:text-white"}`}>
              {isActive(href) && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-brand" />}
              <Icon className="relative size-4" />
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 text-sm">
          <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted hover:bg-surface-2 hover:text-white">
            <ExternalLink className="size-4" /> Ver loja
          </Link>
          <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted hover:bg-surface-2 hover:text-white">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile: topo + abas inferiores */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
        <Image src="/brand/logo.png" alt="" width={32} height={32} className="rounded-lg" />
        <span className="font-display text-sm">ADMIN</span>
        <Link href="/" target="_blank" aria-label="Ver loja" className="ml-auto grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2"><ExternalLink className="size-4" /></Link>
        <button onClick={logout} aria-label="Sair" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2"><LogOut className="size-4" /></button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px]">
            {isActive(href) && <motion.span layoutId="admin-tab" className="absolute top-1 h-8 w-12 rounded-full bg-brand/15" />}
            <Icon className={`relative size-5 ${isActive(href) ? "text-brand" : "text-muted"}`} />
            <span className={isActive(href) ? "text-white" : "text-muted"}>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
