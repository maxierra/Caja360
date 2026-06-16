import { ExternalLink } from "lucide-react";

import {
  CORREO_ARGENTINO_TRACKING_PORTAL,
  correoArgentinoTrackingUrl,
} from "@/lib/store-shipping";

type Props = {
  trackingNumber: string;
  /** Si el transportista no es Correo Argentino, no mostramos estos links. */
  show?: boolean;
};

export function CorreoArgentinoTrackingLinks({ trackingNumber, show = true }: Props) {
  if (!show || !trackingNumber.trim()) return null;

  const directUrl = correoArgentinoTrackingUrl(trackingNumber);

  return (
    <div className="mt-4 space-y-3">
      <a
        href={directUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#002d7a]"
      >
        Consultar envío en Correo Argentino
        <ExternalLink className="size-4" />
      </a>
      <p className="text-center text-xs leading-relaxed text-slate-600">
        Si preferís pegar el número a mano, usá el{" "}
        <a
          href={CORREO_ARGENTINO_TRACKING_PORTAL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sky-800 underline"
        >
          formulario de seguimiento de Correo Argentino
        </a>
        . Tu nº es{" "}
        <span className="font-mono font-semibold text-slate-800">{trackingNumber}</span>.
      </p>
    </div>
  );
}
