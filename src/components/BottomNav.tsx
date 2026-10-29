"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Package, Search, ShoppingBag } from "lucide-react";
import { cart, useCart } from "@/lib/cart";

export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  const items = [
    { href: "/", label: "Início", icon: Home, active: pathname === "/" },
    { href: "/#busca", label: "Buscar", icon: Search, active: false },
    { label: "Carrinho", icon: ShoppingBag, onClick: cart.open, badge: count },
    { href: "/pedidos", label: "Pedidos", icon: Package, active: ["/pedidos", "/conta", "/entrar"].includes(pathname) || pathname.startsWith("/pedido/") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon, active, onClick, badge }) => {
          const inner = (
            <span className="relative flex flex-col items-center gap-1 py-2.5 text-[11px]">
              {active && (
                <motion.span layoutId="nav-pill" className="absolute top-1 h-8 w-12 rounded-full bg-brand/15" />
              )}
              <span className="relative">
                <Icon className={`size-5 ${active ? "text-brand" : "text-muted"}`} />
                {!!badge && (
                  <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-black">
                    {badge}
                  </span>
                )}
              </span>
              <span className={active ? "text-white" : "text-muted"}>{label}</span>
            </span>
          );
          return (
            <li key={label}>
              {href ? (
                <Link href={href} className="block active:scale-95">{inner}</Link>
              ) : (
                <button onClick={onClick} className="block w-full active:scale-95">{inner}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
