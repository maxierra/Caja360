"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminGrantFreeAccess } from "@/app/admin/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  businessId: string;
  compact?: boolean;
};

export function AdminGrantFreeAccessButton({ businessId, compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const onGrant = async () => {
    const ok = window.confirm(
      "¿Dar acceso gratis indefinido a este negocio?\n\nQuedará activo sin fecha de vencimiento hasta que lo bloquees o cambies el plan."
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await adminGrantFreeAccess(businessId);
      if ("error" in res && res.error) {
        if (res.error === "forbidden") toast.error("No tenés permiso de administrador.");
        else if (res.error === "not_found") toast.error("Negocio no encontrado.");
        else toast.error(res.message ?? "No se pudo dar acceso gratis.");
        return;
      }
      if ("ok" in res && res.ok) {
        toast.success("Acceso gratis habilitado", {
          description: "Quedó activo sin vencimiento hasta nuevo cambio desde admin.",
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
      title="Dar acceso gratis indefinido"
      className={cn(
        "shrink-0 border border-sky-500/50 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400",
        compact ? "h-7 px-2 text-[11px]" : "h-8 gap-1.5 rounded-lg"
      )}
      disabled={loading}
      onClick={onGrant}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Gift className="size-3.5" />}
      {compact ? "Gratis" : "Acceso gratis"}
    </Button>
  );
}
