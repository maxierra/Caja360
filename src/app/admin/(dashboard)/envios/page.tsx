import { EnviosClient } from "@/app/admin/(dashboard)/envios/envios-client";
import { loadStoreShipments } from "@/app/admin/(dashboard)/envios/data";

export default async function AdminEnviosPage() {
  const rows = await loadStoreShipments("all");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Envíos de hardware</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos de combos con envío. El cliente recibe tracking por email al despachar.
        </p>
      </div>
      <EnviosClient rows={rows} />
    </div>
  );
}
