export const BUSINESS_TYPES = ["retail", "fashion", "gastronomy"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export type BusinessCapabilities = {
  businessType: BusinessType;
  salesMode: "scanner" | "catalog";
  productMode: "simple" | "variants";
  supportsWeight: boolean;
  supportsBarcode: boolean;
};

const DEFAULT_BUSINESS_TYPE: BusinessType = "retail";

export function normalizeBusinessType(value: string | null | undefined): BusinessType {
  if (value === "fashion" || value === "gastronomy") {
    return value;
  }
  return DEFAULT_BUSINESS_TYPE;
}

export function getBusinessCapabilities(rawBusinessType: string | null | undefined): BusinessCapabilities {
  const businessType = normalizeBusinessType(rawBusinessType);

  switch (businessType) {
    case "fashion":
      return {
        businessType,
        salesMode: "catalog",
        productMode: "variants",
        supportsWeight: false,
        supportsBarcode: true,
      };
    case "gastronomy":
      return {
        businessType,
        salesMode: "catalog",
        productMode: "simple",
        supportsWeight: false,
        supportsBarcode: false,
      };
    default:
      return {
        businessType,
        salesMode: "scanner",
        productMode: "simple",
        supportsWeight: true,
        supportsBarcode: true,
      };
  }
}

export function businessTypeLabel(businessType: string | null | undefined): string {
  switch (normalizeBusinessType(businessType)) {
    case "fashion":
      return "Indumentaria";
    case "gastronomy":
      return "Gastronomía";
    default:
      return "Retail";
  }
}
