import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center p-6 text-center">
      <div>
        <Image src="/brand/logo.png" alt="" width={96} height={96} className="mx-auto rounded-3xl opacity-80" />
        <h1 className="mt-6 font-display text-3xl">Página não encontrada</h1>
        <p className="mt-2 text-muted">Esse produto pode ter saído do catálogo.</p>
        <Link href="/" className="btn-brand mt-6">Voltar para a loja</Link>
      </div>
    </main>
  );
}
