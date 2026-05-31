import { AlertTriangle, Download, KeyRound, PlayCircle, ShieldAlert } from "lucide-react";
import { DESKTOP_DOWNLOAD_TRACKED_PATH } from "@/lib/desktop-download";

const LOOM_URL = "https://www.loom.com/share/de56ee8fc0bc4724a80ec739ae89da2e";

export function LandingDesktopDownload() {
  return (
    <section id="descarga" className="mt-16 scroll-mt-24 md:mt-24" aria-labelledby="descarga-heading">
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/30 to-sky-50/40 p-6 shadow-md shadow-teal-100/50 md:p-8">
        <div className="mb-6 text-center md:mb-8">
          <h2 id="descarga-heading" className="font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Punto de venta de pago único (Windows)
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
            Licencia de por vida por <strong className="font-semibold text-slate-900">$100.000</strong> (pago único). La
            versión en la nube ofrece{" "}
            <strong className="font-semibold text-teal-800">7 días gratis</strong> al registrarte; este instalable es una
            alternativa local.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <Download className="size-3.5" />
              Descarga directa
            </div>
            <p className="text-sm text-slate-600">
              Descargá el sistema desde GitHub Releases y empezá a probarlo en minutos.
            </p>
            <a
              href={`${DESKTOP_DOWNLOAD_TRACKED_PATH}?source=landing`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-md shadow-teal-200/50 transition-colors hover:bg-teal-800"
            >
              <Download className="size-4" />
              Descargar para Windows (.zip)
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-amber-50/80 p-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              <AlertTriangle className="size-3.5" />
              Compatibilidad
            </div>
            <p className="text-sm text-slate-800">
              Este instalable es <strong>solo compatible con Windows</strong>.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Si Windows muestra una advertencia, tocá <strong>&quot;Más información&quot;</strong> y luego{" "}
              <strong>&quot;Ejecutar de todos modos&quot;</strong>.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">¿Cómo usarlo?</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Descargás el sistema.</li>
              <li>Descomprimís el archivo .zip.</li>
              <li>Ejecutás: punto_de_venta.exe.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <KeyRound className="size-4 text-slate-500" />
              Acceso inicial
            </h3>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>
                Usuario: <strong className="font-medium text-slate-900">admin</strong>
              </p>
              <p>
                Clave: <strong className="font-medium text-slate-900">admin123</strong>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PlayCircle className="size-4 text-slate-500" />
              Mirá cómo funciona
            </h3>
            <a
              href={LOOM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
            >
              Ver video tutorial (Loom)
            </a>
            <p className="mt-2 text-xs text-slate-500">Demo del flujo del instalable.</p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-slate-500" />
          <p>
            Si querés la licencia de por vida del escritorio, escribinos y coordinamos la activación. Para la nube, los
            planes y la prueba gratuita están más abajo.
          </p>
        </div>
      </div>
    </section>
  );
}
