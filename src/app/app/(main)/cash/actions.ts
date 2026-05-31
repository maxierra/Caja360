"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { createClient } from "@/lib/supabase/server";

function parseMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(",", ".").trim();
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function parseTime(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function parseMethodTotals(formData: FormData) {
  const cash = parseMoney(formData.get("closing_cash"));
  const card = parseMoney(formData.get("closing_card"));
  const transfer = parseMoney(formData.get("closing_transfer"));
  const mercadopago = parseMoney(formData.get("closing_mercadopago"));
  return { cash, card, transfer, mercadopago };
}

async function openCashRegisterActionImpl(prevState: { success: boolean; error: string | null }, formData: FormData) {
  try {
    const cookieStore = await cookies();
    const businessId = cookieStore.get("active_business_id")?.value;
    if (!businessId) throw new Error("missing_active_business_id");

    const openingAmount = parseMoney(formData.get("opening_amount"));
    const shiftStartAt = parseTime(formData.get("shift_start_at"));
    const shiftEndAt = parseTime(formData.get("shift_end_at"));
    const notes = String(formData.get("notes") ?? "").trim();

    const supabase = await createClient();
    const { error } = await supabase.rpc("open_cash_register", {
      p_business_id: businessId,
      p_opening_amount: openingAmount,
      p_shift_start_at: shiftStartAt,
      p_shift_end_at: shiftEndAt,
      p_notes: notes || null,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/app/cash");
    revalidatePath("/app/pos");
    revalidatePath("/app/onboarding");

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function createCashMovementActionImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) throw new Error("missing_active_business_id");

  const cashRegisterId = String(formData.get("cash_register_id") ?? "").trim();
  const movementType = String(formData.get("movement_type") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const amount = parseMoney(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!cashRegisterId) throw new Error("missing_cash_register_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_cash_movement", {
    p_business_id: businessId,
    p_cash_register_id: cashRegisterId,
    p_movement_type: movementType,
    p_payment_method: paymentMethod,
    p_amount: amount,
    p_reason: reason,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/cash");
}

async function closeCashRegisterActionImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) throw new Error("missing_active_business_id");

  const cashRegisterId = String(formData.get("cash_register_id") ?? "").trim();
  const countedTotals = parseMethodTotals(formData);
  const closingAmount = countedTotals.cash;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!cashRegisterId) throw new Error("missing_cash_register_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_cash_register", {
    p_business_id: businessId,
    p_cash_register_id: cashRegisterId,
    p_closing_amount: closingAmount,
    p_closing_totals: countedTotals,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/app/cash");
  revalidatePath("/app/pos");
}

export const openCashRegisterAction = createMonitoredAction(openCashRegisterActionImpl, "cash/openCashRegister");
export const createCashMovementAction = createMonitoredAction(createCashMovementActionImpl, "cash/createCashMovement");
export const closeCashRegisterAction = createMonitoredAction(closeCashRegisterActionImpl, "cash/closeCashRegister");
