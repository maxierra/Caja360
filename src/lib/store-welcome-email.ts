import { getAppBaseUrl } from "@/lib/app-base-url";
import {
  CORREO_ARGENTINO_TRACKING_PORTAL,
  correoArgentinoTrackingUrl,
} from "@/lib/store-shipping";
import { sendTransactionalEmail } from "@/lib/resend-server";

export async function sendStoreWelcomeEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  password: string;
  trackingToken: string;
  includesHardware: boolean;
}): Promise<void> {
  const base = getAppBaseUrl();
  const loginUrl = `${base}/auth/login`;
  const trackingUrl = `${base}/pedido/${params.trackingToken}`;

  const lines = [
    `Hola ${params.customerName},`,
    "",
    "¡Gracias por tu compra! Tu cuenta ya está activa.",
    "",
    `Negocio: ${params.businessName}`,
    `Email de acceso: ${params.to}`,
    `Contraseña temporal: ${params.password}`,
    "",
    `Ingresá acá: ${loginUrl}`,
    "",
    "Por seguridad, cambiá tu contraseña después del primer ingreso (Configuración o «Olvidé mi contraseña»).",
  ];

  if (params.includesHardware) {
    lines.push(
      "",
      "Tu combo con hardware está en preparación para despacho.",
      "Todavía no tiene número de Correo Argentino; te lo enviamos por mail cuando lo despachemos.",
      "",
      "Podés ver el estado de preparación acá:",
      trackingUrl
    );
  }

  lines.push("", "— Equipo POS");

  await sendTransactionalEmail(params.to, "Tu acceso al POS ya está listo", lines.join("\n"));
}

export async function sendStoreShippedEmail(params: {
  to: string;
  customerName: string;
  trackingNumber: string;
  trackingCarrier: string | null;
  trackingToken: string;
}): Promise<void> {
  const base = getAppBaseUrl();
  const trackingUrl = `${base}/pedido/${params.trackingToken}`;

  const lines = [
    `Hola ${params.customerName},`,
    "",
    "Tu pedido de hardware ya fue despachado.",
    "",
    `Transportista: ${params.trackingCarrier?.trim() || "Correo Argentino"}`,
    `Nº de seguimiento: ${params.trackingNumber}`,
    "",
  ];

  if (!params.trackingCarrier || /correo/i.test(params.trackingCarrier)) {
    lines.push(
      `Consultar envío (número precargado): ${correoArgentinoTrackingUrl(params.trackingNumber)}`,
      `O pegalo en el formulario de Correo Argentino: ${CORREO_ARGENTINO_TRACKING_PORTAL}`,
      ""
    );
  }

  lines.push(`Ver detalle del pedido: ${trackingUrl}`, "", "— Equipo POS");

  await sendTransactionalEmail(params.to, "Tu pedido fue despachado", lines.join("\n"));
}
