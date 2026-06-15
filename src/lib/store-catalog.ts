import type { StaticImageData } from "next/image";

import comboSoftwareImg from "@/combo1.png";
import comboHardwareImg from "@/combo2.png";
import type { StoreProduct } from "@/lib/store-products";
import { getStoreEnvPrice } from "@/lib/store-products";

/** Productos visibles en la tienda (landing). Sin PCs por ahora. */
export const LANDING_STORE_SKUS = ["software_lifetime", "combo_essential"] as const;

export type LandingStoreSku = (typeof LANDING_STORE_SKUS)[number];

export type ProductBenefit = {
  title: string;
  description: string;
};

export type StoreCatalogEntry = {
  displayName: string;
  shortDescription: string;
  longDescription: string;
  purposeTitle: string;
  purposeText: string;
  benefits: ProductBenefit[];
  features: string[];
  badge?: string;
  image?: StaticImageData;
};

const CATALOG: Record<LandingStoreSku, StoreCatalogEntry> = {
  software_lifetime: {
    displayName: "Software POS TIENDA360",
    shortDescription: "Sistema de gestión y POS en la nube. Pago único, licencia de por vida.",
    purposeTitle: "¿Para qué sirve?",
    purposeText:
      "Para manejar tu negocio desde PC, tablet o celular: cobrás en mostrador, controlás stock, ves ventas del día y tenés reportes sin pagar mensualidades. Ideal si ya tenés computadora y solo necesitás el programa.",
    longDescription:
      "TIENDA360 es tu sistema de gestión en la nube. Registrás ventas, actualizás stock, llevás clientes y mirás informes desde cualquier dispositivo. Pagás una sola vez y el acceso es tuyo de por vida.",
    benefits: [
      {
        title: "Ventas y punto de cobro",
        description:
          "Registrá cada venta en segundos desde el mostrador. Cobrás en efectivo, transferencia u otros medios y tenés el comprobante listo al instante.",
      },
      {
        title: "Control de stock",
        description:
          "Sabé en todo momento qué mercadería tenés. Al vender se descuenta solo y evitás quedarte sin producto o vender algo que no hay.",
      },
      {
        title: "Clientes y cuentas",
        description:
          "Guardá datos de tus clientes, llevá fiados y saldos pendientes. Ideal para almacenes y comercios de barrio que venden a cuenta corriente.",
      },
      {
        title: "Reportes e informes",
        description:
          "Mirá cuánto vendiste hoy, qué productos se venden más y cómo va tu negocio. Información clara para tomar mejores decisiones.",
      },
      {
        title: "En la nube, en cualquier dispositivo",
        description:
          "Usalo en PC, notebook, tablet o celular. Tus datos están seguros en la nube y podés consultarlos desde donde estés.",
      },
      {
        title: "Licencia de por vida",
        description:
          "Pagás una sola vez y el sistema es tuyo para siempre. Sin cuotas mensuales ni sorpresas en la factura.",
      },
      {
        title: "Actualizaciones y soporte",
        description:
          "Incluye mejoras del sistema y ayuda por mail o WhatsApp para configurar y resolver dudas.",
      },
    ],
    features: [
      "Ventas y punto de cobro",
      "Control de stock",
      "Clientes y cuentas",
      "Reportes e informes",
      "En la nube — PC, tablet y celular",
      "Actualizaciones y soporte incluidos",
      "Licencia de por vida — sin mensualidades",
    ],
    badge: "Pago único",
    image: comboSoftwareImg,
  },
  combo_essential: {
    displayName: "Combo Punto de Venta",
    shortDescription: "Software + lector de barras + impresora térmica. Envío gratis. Sin PC.",
    purposeTitle: "¿Para qué sirve?",
    purposeText:
      "Para armar un mostrador completo sin comprar una PC nuestra: escaneás productos, imprimís tickets y usás el mismo software TIENDA360. Perfecto para kioscos, almacenes y comercios que quieren empezar a vender con ticket en el día a día.",
    longDescription:
      "El combo incluye todo el hardware esencial del mostrador más la licencia de por vida del software. Te enviamos lector e impresora; usás tu notebook o PC. Al pagar activamos el sistema al instante.",
    benefits: [
      {
        title: "Software POS TIENDA360 (de por vida)",
        description:
          "Incluye la licencia completa: ventas, stock, clientes, reportes y acceso en la nube. Mismo sistema que el plan solo software, sin pagar mensualidades.",
      },
      {
        title: "Impresora térmica de tickets",
        description:
          "Imprimí comprobantes de venta en el mostrador al momento del cobro. Tus clientes se llevan un ticket claro y profesional.",
      },
      {
        title: "Lector de códigos de barras",
        description:
          "Escaneá productos y cargá la venta más rápido, con menos errores de tipeo. Ideal para kioscos y almacenes con muchos artículos.",
      },
      {
        title: "Mostrador listo con tu PC",
        description:
          "No incluimos computadora: usás la que ya tenés. Conectás lector e impresora y empezás a vender el mismo día.",
      },
      {
        title: "Envío gratis a todo el país",
        description:
          "Te enviamos el hardware a domicilio sin costo extra. Recibís lector e impresora listos para conectar.",
      },
      {
        title: "Activación inmediata del software",
        description:
          "Al pagar recibís usuario y clave por email. No tenés que esperar el envío del hardware para empezar a usar el sistema.",
      },
      {
        title: "Soporte técnico incluido",
        description:
          "Te ayudamos a instalar el programa, conectar los equipos y resolver dudas por mail o WhatsApp.",
      },
    ],
    features: [
      "Software POS en la nube (licencia de por vida)",
      "Impresora térmica de tickets",
      "Lector de códigos de barras USB",
      "Gestión de ventas y stock",
      "Reportes e informes",
      "Envío gratis a todo el país",
      "Soporte técnico",
    ],
    badge: "Envío gratis",
    image: comboHardwareImg,
  },
};

export type LandingCatalogProduct = StoreProduct & StoreCatalogEntry;

export function buildLandingCatalog(products: StoreProduct[]): LandingCatalogProduct[] {
  return LANDING_STORE_SKUS.map((sku) => {
    const store =
      products.find((p) => p.sku === sku) ??
      ({
        sku,
        name: sku === "software_lifetime" ? "Software POS TIENDA360" : "Combo Punto de Venta",
        price_ars: getStoreEnvPrice(sku),
        includes_hardware: sku !== "software_lifetime",
        hardware_summary: sku === "combo_essential" ? "Lector + impresora térmica" : null,
        is_active: true,
        sort_order: 0,
      } satisfies StoreProduct);
    const meta = CATALOG[sku];
    return {
      ...store,
      ...meta,
      name: meta.displayName,
    };
  });
}

export type SerializedCatalogProduct = {
  sku: string;
  name: string;
  priceArs: number;
  includesHardware: boolean;
  hardwareSummary: string | null;
  shortDescription: string;
  longDescription: string;
  purposeTitle: string;
  purposeText: string;
  benefits: ProductBenefit[];
  features: string[];
  badge?: string;
  imageSrc: string;
  imageBlur?: string;
};

export function serializeCatalogProduct(p: LandingCatalogProduct): SerializedCatalogProduct {
  return {
    sku: p.sku,
    name: p.name,
    priceArs: p.price_ars,
    includesHardware: p.includes_hardware,
    hardwareSummary: p.hardware_summary,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    purposeTitle: p.purposeTitle,
    purposeText: p.purposeText,
    benefits: p.benefits,
    features: p.features,
    badge: p.badge,
    imageSrc: p.image?.src ?? "",
    imageBlur: p.image?.blurDataURL,
  };
}
