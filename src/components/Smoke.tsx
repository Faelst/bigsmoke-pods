// Fundo animado com "nuvens de fumaça" em CSS puro.
export function Smoke() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 top-0 size-72 animate-float rounded-full bg-brand/25 blur-3xl" />
      <div className="absolute -right-16 top-24 size-80 animate-float rounded-full bg-leaf/20 blur-3xl [animation-delay:-3s]" />
      <div className="absolute bottom-0 left-1/3 size-64 animate-float rounded-full bg-white/10 blur-3xl [animation-delay:-6s]" />
    </div>
  );
}
