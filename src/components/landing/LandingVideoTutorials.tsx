import { PlayCircle } from "lucide-react";

export function LandingVideoTutorials() {
  return (
    <section
      id="tutoriales"
      className="relative mt-16 scroll-mt-24 rounded-3xl bg-gradient-to-b from-violet-50/50 to-transparent pb-4 pt-6 md:mt-20 md:pb-8 md:pt-10"
      aria-labelledby="tutoriales-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="tutoriales-heading"
          className="font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl"
        >
          Video tutoriales
        </h2>
        <p className="mt-2 text-sm text-slate-600 md:text-base">
          Guías paso a paso para sacarle el máximo al sistema. Podés sumar más videos cuando los tengas.
        </p>

        <div className="mt-8 rounded-2xl border border-violet-100 bg-white/90 p-2 shadow-lg shadow-violet-100/60 backdrop-blur-sm">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 to-sky-100">
            <iframe
              src="https://www.loom.com/embed/c119a013531a4928a9ee3dcd98f3fce9"
              className="absolute inset-0 h-full w-full rounded-xl"
              title="Video tutorial - Punto de Venta"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
          <div className="mt-4 text-center">
            <p className="flex items-center justify-center gap-2 text-lg font-medium text-slate-900">
              <PlayCircle className="size-5 text-violet-600" aria-hidden />
              Tutorial completo del sistema
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Primera venta, stock e informes — ideal después de crear tu cuenta.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
