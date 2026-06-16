/** Formulario público de Correo Argentino para pegar el nº de seguimiento. */
export const CORREO_ARGENTINO_TRACKING_PORTAL =
  "https://www.correoargentino.com.ar/formularios/e-commerce";

/** Consulta directa cuando ya tenemos el nº (On Delivery). */
export function correoArgentinoTrackingUrl(trackingNumber: string): string {
  const id = encodeURIComponent(trackingNumber.trim());
  return `https://www.correoargentino.com.ar/formularios/ondelivery?tipoConsulta=envio&id=${id}`;
}
