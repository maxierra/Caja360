"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminActivateSubscription } from "@/app/admin/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  businessId: string;
  billingDays: number;
  /** Fila compacta en tabla admin */
  compact?: boolean;
};

export function AdminQuickActivateButton({ businessId, billingDays, compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const onActivate = async () => {
    const ok = window.confirm(
      `¿Activar este negocio ${billingDays} días desde ahora?\n\nSe marca la suscripción como activa (pago manual / transferencia).`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await adminActivateSubscription(businessId);
      if ("error" in res && res.error) {
        if (res.error === "forbidden") toast.error("No tenés permiso de administrador.");
        else if (res.error === "not_found") toast.error("Negocio no encontrado.");
        else toast.error(res.message ?? "No se pudo activar.");
        return;
      }
      if ("ok" in res && res.ok) {
        toast.success(`Listo: +${billingDays} días`, {
          description: `Hasta ${new Date(res.current_period_end).toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
          })}`,
        });
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="default"
      title={`Activar ${billingDays} días (pago manual)`}
      className={cn(
        "shrink-0 gap-1 rounded-md border border-emerald-500/50 bg-emerald-600 text-white hover:bg-emerald-700",
        compact ? "h-7 px-2 text-[11px]" : "h-8 gap-1.5 rounded-lg"
      )}
      disabled={loading}
      onClick={onActivate}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {compact ? `+${billingDays}d` : `+${billingDays} días`}
    </Button>
  );
}
