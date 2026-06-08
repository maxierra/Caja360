"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminDeactivateSubscription } from "@/app/admin/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  businessId: string;
  compact?: boolean;
};

export function AdminQuickDeactivateButton({ businessId, compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const onDeactivate = async () => {
    const ok = window.confirm(
      "¿Desactivar este negocio?\n\nNo podrá usar el POS ni el resto de la app (excepto la pantalla de suscripción) hasta que lo reactives o pague."
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await adminDeactivateSubscription(businessId);
      if ("error" in res && res.error) {
        if (res.error === "forbidden") toast.error("No tenés permiso de administrador.");
        else if (res.error === "not_found") toast.error(res.message ?? "No hay suscripción para este negocio.");
        else toast.error(res.message ?? "No se pudo desactivar.");
        return;
      }
      if ("ok" in res && res.ok) {
        toast.success("Negocio desactivado", {
          description: "Acceso al POS bloqueado. Podés volver a activarlo con +N días cuando quieras.",
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
      variant="outline"
      title="Desactivar acceso al POS"
      className={cn(
        "shrink-0 border border-destructive/50 bg-destructive text-white hover:bg-destructive/90 dark:text-white",
        compact ? "size-7 p-0" : "h-8 gap-1.5 rounded-lg"
      )}
      disabled={loading}
      onClick={onDeactivate}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : compact ? <Ban className="size-3.5" /> : "Desactivar"}
    </Button>
  );
}
