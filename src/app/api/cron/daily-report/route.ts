import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DailyReportEmail } from "@/components/emails/daily-report-email";

type SplitPaymentDetail = {
  method?: string;
  amount?: number | string;
};

function splitPaymentDetails(value: unknown): SplitPaymentDetail[] {
  if (!value || typeof value !== "object") return [];
  const split = (value as { split?: unknown }).split;
  return Array.isArray(split) ? split : [];
}

// Usamos el cliente con rol de servicio para evitar políticas RLS, ya que no hay un usuario logueado en un cron
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Verificamos el secreto (ignorar si estamos en desarrollo para facilitar las pruebas)
    if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resendApiKey = (process.env.RESEND_API_KEY ?? "").trim();
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    // Calcular las fechas: hoy a las 00:00 y mañana a las 00:00
    const now = new Date();
    // Restamos 1 día si esto se ejecuta a las 00:0X, o usamos hoy si es a las 23:59.
    // Usualmente los Vercel Cron usan UTC, así que es mejor generar el reporte explícitamente sobre el día actual (o anterior) "Argentina"
    // Para no errar con la zona horaria, vamos a forzar UTC-3 (Hora Argentina)
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: 'numeric', month: '2-digit', day: '2-digit' });
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(now);
    const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
    
    const todayStart = new Date(`${dateStr}T00:00:00-03:00`);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 1. Obtener los negocios activos (Limitamos a 1000 para el ejemplo)
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("active", true)
      .limit(10); // TODO: Agregar paginación si hay miles

    if (bizError || !businesses) throw new Error("No se pudieron obtener los negocios");

    let sentCount = 0;

    for (const business of businesses) {
      // 2. Obtener las ventas del día para el negocio
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, total, status, payment_method, payment_details")
        .eq("business_id", business.id)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString());

      if (salesError || !sales) continue;

      const paidSales = sales.filter((s) => s.status === "paid");
      if (paidSales.length === 0) continue; // Si no hay ventas, no mandamos reporte para no molestar

      let totalSales = 0;
      let cashTotal = 0;
      let cardTotal = 0;
      let transferTotal = 0;
      let mpTotal = 0;

      for (const sale of paidSales) {
        const total = Number(sale.total) || 0;
        totalSales += total;
        
        // Manejar split payments o directo
        if (sale.payment_method === "mixed" && typeof sale.payment_details === "object" && sale.payment_details !== null) {
          for (const item of splitPaymentDetails(sale.payment_details)) {
            if (item.method === "cash") cashTotal += Number(item.amount);
            if (item.method === "card") cardTotal += Number(item.amount);
            if (item.method === "transfer") transferTotal += Number(item.amount);
            if (item.method === "mercadopago") mpTotal += Number(item.amount);
          }
        } else {
          if (sale.payment_method === "cash") cashTotal += total;
          if (sale.payment_method === "card") cardTotal += total;
          if (sale.payment_method === "transfer") transferTotal += total;
          if (sale.payment_method === "mercadopago") mpTotal += total;
        }
      }

      // 3. Obtener los items vendidos para los productos Top
      const saleIds = paidSales.map(s => s.id);
      let topProducts: { name: string; qty: number; total: number }[] = [];
      
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("name, quantity, total")
          .in("sale_id", saleIds);
        
        if (items && items.length > 0) {
          const pMap = new Map<string, { qty: number; total: number }>();
          for (const it of items) {
             const exist = pMap.get(it.name) || { qty: 0, total: 0 };
             pMap.set(it.name, { qty: exist.qty + Number(it.quantity), total: exist.total + Number(it.total) });
          }
          topProducts = Array.from(pMap.entries())
            .map(([n, v]) => ({ name: n, qty: v.qty, total: v.total }))
            .sort((a,b) => b.total - a.total)
            .slice(0, 5); // top 5
        }
      }

      // En Producción real: Se enviaría al correo configurado del dueño del negocio.
      // Por ahora, enviaremos al PLATFORM_ADMIN_EMAILS configurado en el .env, para que pruebes que funciona.
      const sendTo = process.env.PLATFORM_ADMIN_EMAILS || "tu-correo@ejemplo.com";

      try {
        await resend.emails.send({
          from: "POS <onboarding@resend.dev>", // Cambia este correo por el que valides en resend
          to: [sendTo],
          subject: `Cierre de Caja - ${business.name} (${dateStr})`,
          react: DailyReportEmail({
            businessName: business.name,
            date: dateStr,
            totalSales,
            totalTickets: paidSales.length,
            cashTotal,
            cardTotal,
            transferTotal,
            mpTotal,
            topProducts
          }) as React.ReactElement,
        });
        sentCount++;
      } catch (err) {
        console.error("Error al enviar email a", business.name, err);
      }
    }

    return NextResponse.json({ success: true, message: `Reportes enviados: ${sentCount}` });

  } catch (error: unknown) {
    console.error("Cron Job Error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
