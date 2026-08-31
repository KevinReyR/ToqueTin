export default function OperatorLoading() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6" role="status">
      <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
      <div className="mt-6 h-56 rounded-xl bg-stone-100" />
      <span className="sr-only">Cargando operación</span>
    </main>
  );
}
