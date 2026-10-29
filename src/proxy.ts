import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: sem cookie de admin, manda para o login.
// A autorização de verdade acontece em cada rota /api/admin.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("bsp_admin")) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
