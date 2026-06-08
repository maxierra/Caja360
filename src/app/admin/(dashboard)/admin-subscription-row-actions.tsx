import { AdminGrantFreeAccessButton } from "@/app/admin/(dashboard)/admin-grant-free-access";
import { AdminQuickActivateButton } from "@/app/admin/(dashboard)/admin-quick-activate";
import { AdminQuickDeactivateButton } from "@/app/admin/(dashboard)/admin-quick-deactivate";
import { AdminRowPromoButton } from "@/app/admin/(dashboard)/admin-row-promo-button";

type Props = {
  businessId: string;
  businessName: string;
  billingDays: number;
};

/** Una sola línea horizontal (+30d, ban, plan, regalo, código); la tabla hace scroll si falta ancho. */
export function AdminSubscriptionRowActions({ businessId, businessName, billingDays }: Props) {
  return (
    <div className="flex w-max shrink-0 flex-nowrap items-center justify-end gap-1">
      <AdminQuickActivateButton businessId={businessId} billingDays={billingDays} compact />
      <AdminGrantFreeAccessButton businessId={businessId} compact />
      <AdminQuickDeactivateButton businessId={businessId} compact />
      <AdminRowPromoButton businessId={businessId} businessName={businessName} />
    </div>
  );
}
