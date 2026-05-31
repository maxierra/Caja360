import { Heart } from "lucide-react";

export function LandingAbout() {
  return (
    <section
      id="nosotros"
      className="relative mt-16 scroll-mt-24 md:mt-24"
      aria-labelledby="nosotros-heading"
    >
      <div className="relative mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/40 to-sky-50/30 px-6 py-10 shadow-md shadow-violet-100/50 md:px-10 md:py-12">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50/90 px-4 py-1.5 text-xs font-medium text-rose-900">
            <Heart className="size-3.5 text-rose-500" aria-hidden />
            Hecho con orgullo en Argentina
          </span>
        </div>

        <h2
          id="nosotros-heading"
          className="text-center font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-4xl"
        >
          Somos una empresa joven que cree en el comercio de verdad
        </h2>

        <div className="mt-8 space-y-5 text-center text-base leading-relaxed text-slate-600 md:text-lg md:leading-relaxed">
          <p>
            Nacimos del mismo lugar que muchos de ustedes: del mostrador, del turno largo, de la cuenta que no cierra y de
            ganas de que la tecnología deje de ser un problema y pase a ser un{" "}
            <strong className="font-semibold text-slate-900">aliado silencioso</strong>.
          </p>
          <p>
            Somos un equipo de desarrollo joven, con las pilas puestas y la cabeza en el día a día del negocio. No vendemos
            promesas imposibles: construimos herramientas pensadas para{" "}
            <strong className="font-semibold text-slate-900">comerciantes argentinos</strong> — kioscos, almacenes,
            ferreterías, negocios familiares y emprendimientos que merecen lo mismo de grande que las cadenas, sin
            complicarse la vida.
          </p>
          <p className="text-slate-700">
            Cada mejora que sumamos es un paso hacia que cobrar, controlar stock y mirar los números sea un poco más fácil,
            un poco más rápido y un poco más humano.{" "}
            <span className="italic text-slate-600">Gracias por confiar en un proyecto que también está creciendo.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
