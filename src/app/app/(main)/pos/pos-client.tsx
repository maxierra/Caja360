"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { shouldCelebrateOnboardingAfterSale } from "@/app/app/(main)/onboarding/actions";
import { ONBOARDING_GUIDE_TOTAL_STEPS } from "@/app/app/(main)/onboarding/onboarding-guide-constants";
import { OnboardingSpotlight } from "@/app/app/(main)/onboarding/onboarding-spotlight";
import { checkoutSale, closeServiceOrder, getTodayDeliveryOrders, saveServiceOrder, updateTableOrderStatus, updateDeliveryOrderStatus } from "@/app/app/(main)/pos/actions";
import type { TodayDeliveryOrderRow } from "@/app/app/(main)/pos/actions";
import { CartPanel } from "@/app/app/(main)/pos/components/CartPanel";
import { POSLayout } from "@/app/app/(main)/pos/components/POSLayout";
import { SalonView } from "@/app/app/(main)/pos/components/SalonView";
import { DeliveryKanban } from "@/app/app/(main)/pos/components/DeliveryKanban";
import { DeliveryHistoryTable } from "@/app/app/(main)/pos/components/DeliveryHistoryTable";
import { DeliveryOrderModal } from "@/app/app/(main)/pos/components/DeliveryOrderModal";
import type { DeliveryOrderFields } from "@/app/app/(main)/pos/components/DeliveryOrderModal";
import { PaymentModal } from "@/app/app/(main)/pos/components/payment-modal";
import { ProductGrid } from "@/app/app/(main)/pos/components/product-grid";
import { SearchBar } from "@/app/app/(main)/pos/components/SearchBar";
import { TableOrderView } from "@/app/app/(main)/pos/components/TableOrderView";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useCart } from "@/app/app/(main)/pos/hooks/use-cart";
import { useProducts, type PosProduct } from "@/app/app/(main)/pos/hooks/use-products";
import { parseScaleBarcode } from "@/app/app/(main)/pos/utils/scale-barcode";
import { beep } from "@/app/app/(main)/pos/utils/beep";
import { buildPaymentLabelMap, sortPaymentMethods, type BusinessPaymentMethodRow } from "@/lib/business-payment-methods";
import { formatSaleTicketPlainText, printTicket as printTicketInBrowser } from "@/lib/ticket-utils";
import { isAndroidUserAgent, printTicket as printTicketRawBt } from "@/utils/printTicket";
import { useIsMobilePos } from "@/hooks/use-is-mobile-pos";
import { Button } from "@/components/ui/button";
import type { BusinessType } from "@/lib/business-types";
import { cn } from "@/lib/utils";
import { ArrowLeft, Bike, Columns3, History, NotebookPen, Save, ScanLine, Store, UtensilsCrossed } from "lucide-react";

export { type PosProduct } from "@/app/app/(main)/pos/hooks/use-products";

export type PosCustomerCredit = {
  id: string;
  name: string;
  /** Límite máximo de deuda permitido. */
  credit_limit: number;
  /** Deuda actual (compras CC − cobros). */
  balance: number;
  /** Saldo disponible para nuevas compras a cuenta: límite − deuda. */
  available_to_spend: number;
};

type PosBusinessInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  cuit: string | null;
  ticket_header: string | null;
  ticket_footer: string | null;
} | null;

export type PosDecodeResult =
  | { ok: false }
  | { ok: true; addedName: string; productId: string; soldByWeight: boolean };

type CheckoutPromotion = {
  name: string;
  percent: number;
  amount: number;
  total_before: number;
  total_after: number;
};

type GastronomyConfig = {
  counterEnabled: boolean;
  deliveryEnabled: boolean;
  tablesEnabled: boolean;
};

type GastronomyTable = {
  id: string;
  name: string;
  active: boolean;
};

type ServiceOrder = {
  id: string;
  type: "delivery" | "table";
  status: string;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  created_at?: string | null;
  service_order_items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
  }> | null;
};

export function PosClient({
  products,
  business,
  businessType = "retail",
  cashOpen = false,
  paymentMethodConfig,
  posCustomers = [],
  mercadoPagoQrReady = false,
  gastronomyConfig = { counterEnabled: true, deliveryEnabled: false, tablesEnabled: false },
  gastronomyTables = [],
  serviceOrders = [],
  guidePosStep = false,
}: {
  products: PosProduct[];
  business: PosBusinessInfo;
  businessType?: BusinessType;
  cashOpen?: boolean;
  paymentMethodConfig: BusinessPaymentMethodRow[];
  /** Lista para ventas en cuenta corriente (incluye límite y saldo disponible). */
  posCustomers?: PosCustomerCredit[];
  mercadoPagoQrReady?: boolean;
  gastronomyConfig?: GastronomyConfig;
  gastronomyTables?: GastronomyTable[];
  serviceOrders?: ServiceOrder[];
  /** Recorrido inicial: foco en escaneo/búsqueda y luego Cobrar. */
  guidePosStep?: boolean;
}) {
  const router = useRouter();
  const isMobilePos = useIsMobilePos();
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const searchGuideRef = React.useRef<HTMLDivElement>(null);
  const cartPanelGuideRef = React.useRef<HTMLDivElement>(null);
  const cobrarGuideRef = React.useRef<HTMLDivElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [serviceMode, setServiceMode] = React.useState<"counter" | "delivery" | "tables">(() => {
    if (businessType !== "gastronomy") return "counter";
    if (gastronomyConfig.counterEnabled) return "counter";
    if (gastronomyConfig.deliveryEnabled) return "delivery";
    if (gastronomyConfig.tablesEnabled) return "tables";
    return "counter";
  });
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);
  const [serviceOrdersState, setServiceOrdersState] = React.useState<ServiceOrder[]>(serviceOrders);
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = React.useState(false);
  const [deliveryViewMode, setDeliveryViewMode] = React.useState<"kanban" | "history">("kanban");
  const [deliveryHistory, setDeliveryHistory] = React.useState<TodayDeliveryOrderRow[]>([]);
  const [deliveryHistoryLoading, setDeliveryHistoryLoading] = React.useState(false);
  const [deliveryName, setDeliveryName] = React.useState("");
  const [deliveryPhone, setDeliveryPhone] = React.useState("");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [serviceNotes, setServiceNotes] = React.useState("");
  const [serviceStatus, setServiceStatus] = React.useState<string>("delivery_new");
  const [notesModalOpen, setNotesModalOpen] = React.useState(false);

  /** When set, auto-open payment once cart loads for this table. */
  const [pendingPaymentForTable, setPendingPaymentForTable] = React.useState(false);

  const cart = useCart();
  // Destructure stable useCallback refs so useEffects don't depend on the
  // plain object that useCart() recreates on every render.
  const { clear: cartClear, replace: cartReplace } = cart;
  const prod = useProducts(products);
  const catalogMode = businessType === "fashion" || businessType === "gastronomy";
  const {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSize,
    setSelectedSize,
    categories,
    sizes,
    filteredCount,
    visible,
    visibleCount,
    loadMore,
    findByBarcodeOrName,
  } = prod;

  const activePaymentMethods = React.useMemo(
    () => sortPaymentMethods(paymentMethodConfig.filter((m) => m.is_active)),
    [paymentMethodConfig]
  );
  const paymentLabelMap = React.useMemo(() => buildPaymentLabelMap(paymentMethodConfig), [paymentMethodConfig]);
  const defaultPaymentMethod = activePaymentMethods[0]?.method_code ?? "cash";
  const gastronomyModes = React.useMemo(
    () =>
      [
        gastronomyConfig.counterEnabled ? { id: "counter" as const, label: "Mostrador", icon: Store } : null,
        gastronomyConfig.deliveryEnabled ? { id: "delivery" as const, label: "Delivery", icon: Bike } : null,
        gastronomyConfig.tablesEnabled ? { id: "tables" as const, label: "Mesas", icon: UtensilsCrossed } : null,
      ].filter(Boolean) as Array<{ id: "counter" | "delivery" | "tables"; label: string; icon: typeof Store }>,
    [gastronomyConfig]
  );
  const selectedTableName = gastronomyTables.find((table) => table.id === selectedTableId)?.name ?? null;
  const activeServiceOrder = React.useMemo(
    () => serviceOrdersState.find((order) => order.id === activeOrderId) ?? null,
    [serviceOrdersState, activeOrderId]
  );
  const deliveryOrders = React.useMemo(
    () =>
      serviceOrdersState.filter(
        (order) => order.type === "delivery" && order.status !== "delivery_closed"
      ),
    [serviceOrdersState]
  );
  const tableOrdersByTableId = React.useMemo(() => {
    const map = new Map<string, ServiceOrder>();
    for (const order of serviceOrdersState) {
      if (order.type === "table" && order.table_id) {
        map.set(order.table_id, order);
      }
    }
    return map;
  }, [serviceOrdersState]);
  const cartContextLabel =
    businessType !== "gastronomy"
      ? null
      : serviceMode === "counter"
        ? "Venta por mostrador"
        : serviceMode === "delivery"
          ? "Pedido delivery"
          : selectedTableName
            ? `Pedido en ${selectedTableName}`
            : "Elegí una mesa para tomar el pedido";

  const hasMore = visibleCount < filteredCount;

  const addProduct = React.useCallback(
    (p: PosProduct, opts?: { silentToast?: boolean }) => {
      cart.add(p);
      beep();
      setQuery("");
      if (!opts?.silentToast) {
        toast.success("Agregado", { description: p.name, duration: 900 });
      }

      const shouldAutoFocusInputs = !(isMobilePos && scannerOpen);

      if (p.sold_by_weight) {
        setTimeout(() => {
          if (!shouldAutoFocusInputs) return;
          const input = document.getElementById(`qty-input-${p.id}`) as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      } else if (shouldAutoFocusInputs) {
        searchRef.current?.focus();
      }
    },
    [cart, isMobilePos, scannerOpen, searchRef, setQuery]
  );

  const loadOrderIntoCart = React.useCallback(
    (order: ServiceOrder | null) => {
      cartReplace(
        (order?.service_order_items ?? []).map((item) => ({
          product_id: item.product_id,
          name: item.name,
          sold_by_weight: false,
          unit_price: item.unit_price,
          quantity: item.quantity,
        }))
      );
    },
    [cartReplace]
  );

  const procesarCodigo = React.useCallback(
    (raw: string, opts?: { silentToast?: boolean }): PosDecodeResult => {
      const q = raw.replace(/\s+/g, "").trim();
      if (!q) return { ok: false };

      const found = findByBarcodeOrName(q);
      if (found) {
        addProduct(found, { silentToast: opts?.silentToast });
        if (typeof console !== "undefined") console.log("[POS] Código procesado:", q);
        return {
          ok: true,
          addedName: found.name,
          productId: found.id,
          soldByWeight: found.sold_by_weight,
        };
      }

      const parsed = parseScaleBarcode(q);
      if (parsed) {
        const byScaleCode = products.find((p) => (p.scale_code ?? "").toLowerCase() === parsed.scaleCode.toLowerCase());
        if (byScaleCode && byScaleCode.sold_by_weight) {
          cart.add(byScaleCode, { quantity: parsed.weightKg });
          beep();
          if (!opts?.silentToast) {
            toast.success("Producto agregado", {
              description: `${byScaleCode.name} · ${parsed.weightKg} kg`,
            });
          }
          setQuery("");
          if (typeof console !== "undefined") console.log("[POS] Código procesado (balanza):", q);
          return {
            ok: true,
            addedName: `${byScaleCode.name} · ${parsed.weightKg} kg`,
            productId: byScaleCode.id,
            soldByWeight: true,
          };
        }
      }

      setQuery(raw.trim());
      toast.error("No se encontró el producto");
      return { ok: false };
    },
    [addProduct, findByBarcodeOrName, products, cart, setQuery]
  );

  const onSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      void procesarCodigo(query);
    },
    [procesarCodigo, query]
  );

  const getCartQuantityForProduct = React.useCallback(
    (productId: string) => cart.items.find((i) => i.product_id === productId)?.quantity ?? 0,
    [cart.items]
  );

  const onAdjustCartQuantityFromScanner = React.useCallback(
    (productId: string, direction: "inc" | "dec") => {
      const item = cart.items.find((i) => i.product_id === productId);
      if (!item) return;
      if (direction === "inc") {
        cart.inc(item);
        beep();
        return;
      }
      if (item.sold_by_weight) {
        if (item.quantity <= 0.051) return;
      } else if (item.quantity <= 1) {
        return;
      }
      cart.dec(item);
    },
    [cart]
  );

  const onAdvanceKanbanStatus = React.useCallback(
    async (tableId: string, orderId: string, nextStatus: "occupied" | "preparing" | "served") => {
      try {
        await updateTableOrderStatus({ id: orderId, status: nextStatus });
        setServiceOrdersState((prev) =>
          prev.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
        );
        if (tableId === selectedTableId) {
          setServiceStatus(nextStatus);
        }
        toast.success("Estado actualizado");
      } catch (err) {
        toast.error("No se pudo actualizar el estado", {
          description: err instanceof Error ? err.message : "Error",
        });
      }
    },
    [selectedTableId]
  );

  const openPayment = React.useCallback(() => {
    if (cart.items.length === 0) return;
    if (!cashOpen) {
      toast.error("Caja cerrada", {
        description: "Debés abrir un turno de caja para poder vender. Ve a la sección Caja.",
      });
      return;
    }
    if (activePaymentMethods.length === 0) {
      toast.error("Sin medios de pago activos", {
        description: "Activá al menos uno en Configuración → Medios de pago.",
      });
      return;
    }
    setPaymentOpen(true);
  }, [cart.items.length, cashOpen, activePaymentMethods.length]);

  /** Opens the table order modal (clears any pending auto-payment). */
  const onSelectTable = React.useCallback((tableId: string) => {
    setPendingPaymentForTable(false);
    setSelectedTableId(tableId);
  }, []);

  /** Called from SalonView "Cobrar" button — navigate to table then auto-open payment. */
  const onPayTable = React.useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    setPendingPaymentForTable(true);
  }, []);

  /** Opens the table order modal to add more items (served tables). */
  const onEditTableOrder = React.useCallback((tableId: string) => {
    setPendingPaymentForTable(false);
    setSelectedTableId(tableId);
  }, []);

  /** Auto-open payment once the cart loads after onPayTable is called. */
  React.useEffect(() => {
    if (!pendingPaymentForTable) return;
    if (cart.items.length === 0) return;
    setPendingPaymentForTable(false);
    openPayment();
  }, [pendingPaymentForTable, cart.items.length, openPayment]);

  const closePayment = React.useCallback(() => {
    setPaymentOpen(false);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        openPayment();
      }
      if (e.key === "Escape") {
        if (paymentOpen) {
          e.preventDefault();
          closePayment();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePayment, openPayment, paymentOpen]);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!catalogMode) return;
    if (selectedCategory !== "all") return;
    if (categories.length < 2) return;
    setSelectedCategory(categories[1] ?? "all");
  }, [catalogMode, categories, selectedCategory, setSelectedCategory]);

  React.useEffect(() => {
    if (businessType !== "gastronomy") return;
    if (serviceMode !== "tables") {
      setSelectedTableId(null);
    }
  }, [businessType, serviceMode]);

  React.useEffect(() => {
    if (businessType !== "gastronomy") return;
    if (serviceMode === "counter") {
      setActiveOrderId(null);
      setDeliveryName("");
      setDeliveryPhone("");
      setDeliveryAddress("");
      setServiceNotes("");
      setServiceStatus("delivery_new");
      cartClear();
      return;
    }

    if (serviceMode === "delivery") {
      // Delivery kanban: entering this mode resets to a clean slate.
      // Individual order loading happens when the user opens the modal.
      setActiveOrderId(null);
      setDeliveryName("");
      setDeliveryPhone("");
      setDeliveryAddress("");
      setServiceNotes("");
      setServiceStatus("delivery_new");
      cartClear();
      return;
    }

    if (serviceMode === "tables") {
      if (!selectedTableId) {
        cartClear();
        setActiveOrderId(null);
        setServiceNotes("");
        setServiceStatus("occupied");
        return;
      }
      const order = tableOrdersByTableId.get(selectedTableId) ?? null;
      setActiveOrderId(order?.id ?? null);
      setServiceNotes(order?.notes ?? "");
      setServiceStatus(order?.status ?? "occupied");
      loadOrderIntoCart(order);
    }
  }, [businessType, cartClear, loadOrderIntoCart, selectedTableId, serviceMode, tableOrdersByTableId]);

  const persistCurrentServiceOrder = React.useCallback(async () => {
    if (serviceMode === "counter") return;
    if (serviceMode === "tables" && !selectedTableId) {
      toast.error("Elegí una mesa");
      return;
    }
    if (!cart.items.length) {
      toast.error("Agregá productos al pedido");
      return;
    }
    if (serviceMode === "delivery" && !deliveryName.trim()) {
      toast.error("Completá al menos el nombre del cliente");
      return;
    }

    const payload = {
      id: activeOrderId,
      type: serviceMode === "tables" ? ("table" as const) : ("delivery" as const),
      status:
        serviceMode === "tables"
          ? (((activeOrderId === null ? "occupied" : serviceStatus) || "occupied") as "occupied" | "preparing" | "served")
          : ((serviceStatus || "delivery_new") as "delivery_new" | "delivery_preparing" | "delivery_ready" | "delivery_on_the_way"),
      table_id: serviceMode === "tables" ? selectedTableId : null,
      customer_name: serviceMode === "delivery" ? deliveryName : null,
      customer_phone: serviceMode === "delivery" ? deliveryPhone : null,
      delivery_address: serviceMode === "delivery" ? deliveryAddress : null,
      notes: serviceNotes,
      items: cart.items.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    };

    try {
      const saved = await saveServiceOrder(payload);
      const nextOrder: ServiceOrder = {
        id: (saved as { id: string }).id,
        type: payload.type,
        status: payload.status,
        table_id: payload.table_id ?? null,
        customer_name: payload.customer_name ?? null,
        customer_phone: payload.customer_phone ?? null,
        delivery_address: payload.delivery_address ?? null,
        notes: payload.notes ?? null,
        service_order_items: payload.items,
      };
      setActiveOrderId(nextOrder.id);
      setServiceOrdersState((prev) => {
        const others = prev.filter((order) => order.id !== nextOrder.id && !(nextOrder.type === "table" && order.table_id === nextOrder.table_id));
        return [nextOrder, ...others];
      });
      toast.success(serviceMode === "tables" ? "Pedido de mesa guardado" : "Pedido delivery guardado");
      return true as const;
    } catch (err) {
      toast.error("No se pudo guardar el pedido", { description: err instanceof Error ? err.message : "Error" });
    }
  }, [activeOrderId, cart.items, deliveryAddress, deliveryName, deliveryPhone, selectedTableId, serviceMode, serviceNotes, serviceStatus]);

  /** Opens the delivery modal to create a fresh order. */
  const openNewDeliveryOrder = React.useCallback(() => {
    setActiveOrderId(null);
    setDeliveryName("");
    setDeliveryPhone("");
    setDeliveryAddress("");
    setServiceNotes("");
    setServiceStatus("delivery_new");
    cartClear();
    setDeliveryModalOpen(true);
  }, [cartClear]);

  /** Opens the delivery modal to edit an existing order. */
  const openEditDeliveryOrder = React.useCallback(
    (orderId: string) => {
      const order = serviceOrdersState.find((o) => o.id === orderId) ?? null;
      if (!order) return;
      setActiveOrderId(order.id);
      setDeliveryName(order.customer_name ?? "");
      setDeliveryPhone(order.customer_phone ?? "");
      setDeliveryAddress(order.delivery_address ?? "");
      setServiceNotes(order.notes ?? "");
      setServiceStatus(order.status);
      loadOrderIntoCart(order);
      setDeliveryModalOpen(true);
    },
    [loadOrderIntoCart, serviceOrdersState]
  );

  const closeDeliveryModal = React.useCallback(() => {
    setDeliveryModalOpen(false);
    setActiveOrderId(null);
    setDeliveryName("");
    setDeliveryPhone("");
    setDeliveryAddress("");
    setServiceNotes("");
    setServiceStatus("delivery_new");
    cartClear();
  }, [cartClear]);

  /** Saves a delivery order from the modal with explicit customer fields. */
  const onDeliveryModalSave = React.useCallback(
    async (fields: DeliveryOrderFields) => {
      if (!cart.items.length) {
        toast.error("Agregá productos al pedido");
        return;
      }
      if (!fields.name.trim()) {
        toast.error("Completá al menos el nombre del cliente");
        return;
      }

      const statusForSave = activeOrderId
        ? ((serviceStatus || "delivery_new") as
            | "delivery_new"
            | "delivery_preparing"
            | "delivery_ready"
            | "delivery_on_the_way")
        : "delivery_new";

      const payload = {
        id: activeOrderId,
        type: "delivery" as const,
        status: statusForSave,
        table_id: null,
        customer_name: fields.name,
        customer_phone: fields.phone,
        delivery_address: fields.address,
        notes: fields.notes,
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      try {
        const saved = await saveServiceOrder(payload);
        const prior = activeOrderId
          ? serviceOrdersState.find((o) => o.id === activeOrderId) ?? null
          : null;
        const nextOrder: ServiceOrder = {
          id: (saved as { id: string }).id,
          type: "delivery",
          status: statusForSave,
          table_id: null,
          customer_name: fields.name || null,
          customer_phone: fields.phone || null,
          delivery_address: fields.address || null,
          notes: fields.notes || null,
          created_at: prior?.created_at ?? new Date().toISOString(),
          service_order_items: payload.items,
        };

        setServiceOrdersState((prev) => {
          const others = prev.filter((o) => o.id !== nextOrder.id);
          return [nextOrder, ...others];
        });

        setDeliveryModalOpen(false);
        setActiveOrderId(null);
        cartClear();
        toast.success("Pedido delivery guardado");
      } catch (err) {
        toast.error("No se pudo guardar el pedido", {
          description: err instanceof Error ? err.message : "Error",
        });
      }
    },
    [activeOrderId, cart.items, cartClear, serviceOrdersState, serviceStatus]
  );

  /** Advances a delivery order to the next kanban status. */
  const onAdvanceDeliveryStatus = React.useCallback(
    async (orderId: string, nextStatus: string) => {
      try {
        await updateDeliveryOrderStatus({
          id: orderId,
          status: nextStatus as
            | "delivery_new"
            | "delivery_preparing"
            | "delivery_ready"
            | "delivery_on_the_way",
        });
        setServiceOrdersState((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: nextStatus } : order
          )
        );
        toast.success("Estado actualizado");
      } catch (err) {
        toast.error("No se pudo actualizar el estado", {
          description: err instanceof Error ? err.message : "Error",
        });
      }
    },
    []
  );

  /** Loads a delivery order's items and opens the payment modal. */
  const onPayDeliveryOrder = React.useCallback(
    (orderId: string) => {
      const order = serviceOrdersState.find((o) => o.id === orderId) ?? null;
      if (!order) return;
      setActiveOrderId(orderId);
      setDeliveryName(order.customer_name ?? "");
      setDeliveryPhone(order.customer_phone ?? "");
      setDeliveryAddress(order.delivery_address ?? "");
      setServiceNotes(order.notes ?? "");
      setServiceStatus(order.status);
      loadOrderIntoCart(order);
      setPendingPaymentForTable(true);
    },
    [loadOrderIntoCart, serviceOrdersState]
  );

  const refreshDeliveryHistory = React.useCallback(async () => {
    setDeliveryHistoryLoading(true);
    try {
      const result = await getTodayDeliveryOrders();
      setDeliveryHistory(result.orders);
    } catch (err) {
      toast.error("No se pudo cargar el historial", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setDeliveryHistoryLoading(false);
    }
  }, []);

  const onConfirmPayment = React.useCallback(
    (p: {
      payment_method: "cash" | "card" | "mercadopago" | "transfer" | "cuenta_corriente" | "mixed";
      payment_details?: {
        split: Array<{ method: "cash" | "card" | "mercadopago" | "transfer" | "cuenta_corriente"; amount: number }>;
      };
      cash_received?: number;
      print_ticket?: boolean;
      customer_id?: string | null;
    }) => {
      if (cart.items.length === 0) return;

      // RawBT (Android): deep link tras el cobro; no hace falta popup. Resto: ventana para window.print().
      const useRawBt = Boolean(p.print_ticket && isAndroidUserAgent());
      const printWin = p.print_ticket && !useRawBt ? window.open("about:blank", "_blank") : null;

      startTransition(() => {
        (async () => {
          try {
            const paymentDetailsWithCash =
              p.cash_received != null
                ? {
                    ...(p.payment_details ?? {}),
                    cash_received: p.cash_received,
                  }
                : p.payment_details;

            const res = await checkoutSale({
              payment_method: p.payment_method,
              payment_details: paymentDetailsWithCash,
              cash_received: p.cash_received,
              customer_id: p.customer_id ?? null,
              items: cart.items.map((it) => ({
                product_id: it.product_id,
                name: it.name,
                quantity: it.quantity,
                unit_price: it.unit_price,
              })),
            });

            if (activeOrderId && (serviceMode === "delivery" || serviceMode === "tables")) {
              await closeServiceOrder({ id: activeOrderId });
              setServiceOrdersState((prev) => prev.filter((order) => order.id !== activeOrderId));
              setActiveOrderId(null);
              if (serviceMode === "delivery") {
                setDeliveryName("");
                setDeliveryPhone("");
                setDeliveryAddress("");
                setServiceNotes("");
                setServiceStatus("delivery_new");
                void refreshDeliveryHistory();
              } else {
                setServiceNotes("");
                setServiceStatus("occupied");
                setSelectedTableId(null);
              }
            }

            const promo = (res as { promotion?: CheckoutPromotion | null }).promotion;
            const fiscal = (res as { fiscal?: {
              voucherTypeLabel: string;
              posNumber: number;
              voucherNumber: number;
              cae: string;
              caeExpiresAt: string;
              qrPayload: string;
            } | null }).fiscal;

            if (p.print_ticket) {
              const ticketData = {
                kind: "sale" as const,
                business,
                items: cart.items,
                total: promo?.total_after ?? cart.total,
                saleId: res.saleId,
                paymentMethod: p.payment_method,
                paymentMethodLabels: paymentLabelMap,
                cashReceived: p.cash_received,
                promotion: promo ?? null,
                fiscal: fiscal
                  ? {
                      voucherTypeLabel: fiscal.voucherTypeLabel,
                      posNumber: fiscal.posNumber,
                      voucherNumber: fiscal.voucherNumber,
                      cae: fiscal.cae,
                      caeExpiresAt: fiscal.caeExpiresAt,
                      qrPayload: fiscal.qrPayload,
                    }
                  : undefined,
              };
              if (useRawBt) {
                printTicketRawBt(formatSaleTicketPlainText(ticketData));
              } else {
                const ok = printTicketInBrowser(ticketData, { preOpenedWindow: printWin });
                if (!ok && printWin && !printWin.closed) printWin.close();
              }
            } else if (printWin && !printWin.closed) {
              printWin.close();
            }

            cart.clear();
            closePayment();
            const fiscalHint = fiscal
              ? ` · ${fiscal.voucherTypeLabel} ${fiscal.cae.slice(0, 8)}…`
              : "";
            toast.success("Venta registrada", {
              description: promo
                ? `ID ${res.saleId.slice(0, 8)} · Promo: ${promo.name} (-$${promo.amount.toFixed(2)})${fiscalHint}`
                : `ID ${res.saleId.slice(0, 8)}${fiscalHint}`,
            });

            const celebrate = await shouldCelebrateOnboardingAfterSale();
            if (celebrate) {
              router.push("/app/onboarding?celebrate=1");
              return;
            }
            router.refresh();
          } catch (err) {
            if (printWin && !printWin.closed) printWin.close();
            toast.error("No se pudo cobrar", {
              description: err instanceof Error ? err.message : "Error",
            });
          }
        })();
      });
    },
    [
      activeOrderId,
      business,
      cart,
      closePayment,
      paymentLabelMap,
      router,
      serviceMode,
      startTransition,
      refreshDeliveryHistory,
    ]
  );

  const onMercadoPagoAutoPaid = React.useCallback(
    ({ saleId, printTicket: shouldPrint }: { saleId: string; printTicket: boolean }) => {
      if (cart.items.length === 0) return;
      const ticketPayload = shouldPrint
        ? {
            kind: "sale" as const,
            business,
            items: cart.items,
            total: cart.total,
            saleId,
            paymentMethod: "mercadopago",
            paymentMethodLabels: paymentLabelMap,
            cashReceived: undefined,
          }
        : null;
      cart.clear();
      closePayment();
      if (activeOrderId && (serviceMode === "delivery" || serviceMode === "tables")) {
        void closeServiceOrder({ id: activeOrderId });
        setServiceOrdersState((prev) => prev.filter((order) => order.id !== activeOrderId));
        setActiveOrderId(null);
        if (serviceMode === "delivery") {
          setDeliveryName("");
          setDeliveryPhone("");
          setDeliveryAddress("");
          setServiceNotes("");
          setServiceStatus("delivery_new");
          void refreshDeliveryHistory();
        } else {
          setServiceNotes("");
          setServiceStatus("occupied");
          setSelectedTableId(null);
        }
      }
      toast.success("Pago acreditado — venta registrada", {
        description: `ID ${saleId.slice(0, 8)}`,
        ...(ticketPayload && {
          action: {
            label: "Imprimir ticket",
            onClick: () => {
              if (isAndroidUserAgent()) {
                printTicketRawBt(formatSaleTicketPlainText(ticketPayload));
              } else {
                printTicketInBrowser(ticketPayload);
              }
            },
          },
        }),
      });
      void (async () => {
        const celebrate = await shouldCelebrateOnboardingAfterSale();
        if (celebrate) {
          router.push("/app/onboarding?celebrate=1");
          return;
        }
        router.refresh();
      })();
    },
    [activeOrderId, business, cart, closePayment, paymentLabelMap, refreshDeliveryHistory, router, serviceMode]
  );

  const posGuideActive = Boolean(guidePosStep && cashOpen && !paymentOpen);
  const posSpotlightRef = cart.items.length > 0 ? cobrarGuideRef : searchGuideRef;

  /** True when the salon floor-plan should be the base layout (tables mode). */
  const showSalonView = businessType === "gastronomy" && serviceMode === "tables";
  /** True when the delivery kanban should be the base layout (delivery mode). */
  const showDeliveryView = businessType === "gastronomy" && serviceMode === "delivery";
  /** True when the table order modal should be shown over the salon. */
  const tableModalOpen = showSalonView && !!selectedTableId;

  React.useEffect(() => {
    if (!posGuideActive || cart.items.length > 0) return;
    const id = window.requestAnimationFrame(() => {
      searchGuideRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [posGuideActive, cart.items.length]);

  React.useEffect(() => {
    if (serviceMode !== "delivery") {
      setDeliveryViewMode("kanban");
    }
  }, [serviceMode]);

  React.useEffect(() => {
    if (!showDeliveryView) return;
    if (deliveryViewMode !== "history") return;
    void refreshDeliveryHistory();
  }, [showDeliveryView, deliveryViewMode, refreshDeliveryHistory]);

  return (
    <div className="relative">
      <OnboardingSpotlight
        active={posGuideActive}
        targetRef={posSpotlightRef}
        stackBase={55}
        dimBackground={false}
        stepIndex={4}
        totalSteps={ONBOARDING_GUIDE_TOTAL_STEPS}
        title={cart.items.length > 0 ? "Cobrar la venta" : "Escaneá o buscá un producto"}
        description={
          cart.items.length > 0
            ? "Tocá «Cobrar», elegí el medio de pago y confirmá el cobro. Con eso completás tu primera venta guiada."
            : "Usá el buscador/escáner para agregar un producto al carrito. Después te guiamos al botón Cobrar."
        }
      />

      {!cashOpen && (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Caja cerrada:</span> Abrí un turno en la sección{" "}
          <a href="/app/cash" className="underline hover:text-amber-600">Caja</a> para poder vender.
        </div>
      )}
      {showSalonView && (
        <div className="min-h-[calc(100dvh-7rem)] bg-[var(--pos-bg)]">
          <div className="mx-auto w-full max-w-7xl px-3 pt-2 pb-8 sm:px-4 sm:pt-4">
            {/* Mode tabs */}
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-3 shadow-sm">
              {gastronomyModes.map((mode) => {
                const Icon = mode.icon;
                const active = serviceMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setServiceMode(mode.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-border)]"
                    )}
                  >
                    <Icon className="size-4" />
                    {mode.label}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <UtensilsCrossed className="size-3.5" />
                <span className="font-semibold">Salón</span>
              </div>
            </div>
            {/* Salon floor-plan grid */}
            <SalonView
              tables={gastronomyTables}
              tableOrdersByTableId={tableOrdersByTableId}
              onSelectTable={onSelectTable}
              onAdvanceStatus={onAdvanceKanbanStatus}
              onPayTable={onPayTable}
              onEditTableOrder={onEditTableOrder}
            />
          </div>

          {/* Table order modal — overlays the salon without replacing it */}
          {tableModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1 sm:p-2">
              <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--pos-surface)] shadow-2xl h-[92dvh]">
                <button
                  type="button"
                  onClick={() => setSelectedTableId(null)}
                  className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-[var(--pos-surface-2)] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <TableOrderView
                  tableName={selectedTableName ?? "Mesa"}
                  items={cart.items}
                  categories={categories}
                  products={visible}
                  allProducts={products}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  serviceStatus={serviceStatus}
                  serviceNotes={serviceNotes}
                  onAddProduct={(p) => addProduct(p, { silentToast: true })}
                  onRemoveProduct={cart.remove}
                  onSetQty={cart.setQty}
                  onSave={async () => {
                    const ok = await persistCurrentServiceOrder();
                    if (ok) setSelectedTableId(null);
                  }}
                  onBack={() => setSelectedTableId(null)}
                  onOpenNotes={() => setNotesModalOpen(true)}
                  onOpenPayment={openPayment}
                  pending={pending}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showDeliveryView && (
        <div className="min-h-[calc(100dvh-7rem)] bg-[var(--pos-bg)]">
          <div className="mx-auto w-full max-w-7xl px-3 pt-2 pb-8 sm:px-4 sm:pt-4">
            {/* Mode tabs */}
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-3 shadow-sm">
              {gastronomyModes.map((mode) => {
                const Icon = mode.icon;
                const active = serviceMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setServiceMode(mode.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-border)]"
                    )}
                  >
                    <Icon className="size-4" />
                    {mode.label}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bike className="size-3.5" />
                <span className="font-semibold">Delivery</span>
              </div>
            </div>

            {/* Kanban / Historial toggle */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center overflow-hidden rounded-xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] p-0.5">
                <button
                  type="button"
                  onClick={() => setDeliveryViewMode("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    deliveryViewMode === "kanban"
                      ? "bg-[var(--pos-surface)] text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Columns3 className="size-3.5" />
                  Kanban
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryViewMode("history")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    deliveryViewMode === "history"
                      ? "bg-[var(--pos-surface)] text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="size-3.5" />
                  Historial del día
                </button>
              </div>
            </div>

            {deliveryViewMode === "kanban" ? (
            <DeliveryKanban
              business={business}
              orders={deliveryOrders}
              onNewOrder={openNewDeliveryOrder}
              onEditOrder={openEditDeliveryOrder}
              onAdvanceStatus={onAdvanceDeliveryStatus}
              onPayOrder={onPayDeliveryOrder}
            />
            ) : (
            <DeliveryHistoryTable
              orders={deliveryHistory}
              loading={deliveryHistoryLoading}
              onRefresh={() => void refreshDeliveryHistory()}
            />
            )}
          </div>

          {/* Delivery order modal — overlays the kanban */}
          {deliveryModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1 sm:p-2">
              <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--pos-surface)] shadow-2xl h-[92dvh]">
                <button
                  type="button"
                  onClick={closeDeliveryModal}
                  className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-[var(--pos-surface-2)] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <DeliveryOrderModal
                  key={activeOrderId ?? "new"}
                  orderId={activeOrderId}
                  initialName={deliveryName}
                  initialPhone={deliveryPhone}
                  initialAddress={deliveryAddress}
                  initialNotes={serviceNotes}
                  items={cart.items}
                  categories={categories}
                  products={visible}
                  allProducts={products}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onAddProduct={(p) => addProduct(p, { silentToast: true })}
                  onRemoveProduct={cart.remove}
                  onSetQty={cart.setQty}
                  onSave={onDeliveryModalSave}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!showSalonView && !showDeliveryView && (
      <POSLayout
        header={
          <div className="flex w-full flex-col gap-2">
            {/* Compact table order bar — only when a table is selected */}
            {serviceMode === "tables" && selectedTableId && (
              <div className="flex flex-wrap items-center gap-1.5">
                {/* ← Salón */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl border-slate-300 text-xs font-semibold"
                  onClick={() => setSelectedTableId(null)}
                >
                  <ArrowLeft className="size-3.5" />
                  Salón
                </Button>

                {/* Separator */}
                <span className="mx-0.5 hidden h-5 w-px bg-[var(--pos-border)] sm:block" />

                {/* Table name */}
                <span className="text-sm font-extrabold tracking-tight text-foreground">
                  {selectedTableName}
                </span>

                {cart.items.length === 0 ? (
                  /* Empty cart — just show a hint, no actions needed */
                  <span className="text-xs text-muted-foreground">Agregá productos al pedido</span>
                ) : (
                  <>
                    {/* Separator */}
                    <span className="mx-0.5 hidden h-5 w-px bg-[var(--pos-border)] sm:block" />

                    {/* Status pills */}
                    <div className="flex gap-1">
                      {[
                        { id: "occupied", label: "Ocupada" },
                        { id: "preparing", label: "En prep." },
                        { id: "served", label: "Servida" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setServiceStatus(s.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            serviceStatus === s.id
                              ? "border-foreground bg-foreground text-background"
                              : "border-[var(--pos-border)] bg-[var(--pos-surface)] text-muted-foreground hover:border-[var(--pos-border)]"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Notes button */}
                    <button
                      type="button"
                      onClick={() => setNotesModalOpen(true)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                        serviceNotes.trim()
                          ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
                          : "border-[var(--pos-border)] bg-[var(--pos-surface)] text-muted-foreground hover:border-[var(--pos-border)]"
                      )}
                    >
                      <NotebookPen className="size-3.5" />
                      <span className="hidden sm:inline">{serviceNotes.trim() ? "Ver nota" : "Notas"}</span>
                    </button>

                    {/* Guardar */}
                    <button
                      type="button"
                      onClick={() => void persistCurrentServiceOrder()}
                      className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800"
                    >
                      <Save className="size-3.5" />
                      Guardar
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Search + scan row */}
            <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3">
              <Button
                type="button"
                variant="outline"
                className="order-1 h-14 w-full shrink-0 gap-2 rounded-2xl border-[var(--pos-accent)]/40 bg-[var(--pos-surface-2)] text-base font-semibold hover:bg-[var(--pos-accent)]/10 lg:order-2 lg:h-12 lg:w-auto lg:min-w-[9rem] lg:rounded-xl"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine className="size-5" />
                {catalogMode ? "Escanear opcional" : "Escanear"}
              </Button>
              <div
                ref={searchGuideRef}
                className={cn(
                  "order-2 min-w-0 flex-1 lg:order-1",
                  posGuideActive &&
                    cart.items.length === 0 &&
                    "relative z-[82] rounded-2xl shadow-[0_0_0_4px_rgba(16,185,129,0.55),0_8px_40px_-8px_rgba(16,185,129,0.35)]"
                )}
              >
                <SearchBar
                  inputRef={searchRef}
                  value={query}
                  onChange={setQuery}
                  onKeyDown={onSearchKeyDown}
                  placeholder={catalogMode ? "Buscar por nombre o categoría..." : undefined}
                />
              </div>
            </div>
          </div>
        }
        left={
          <div>
            {/* Gastronomy mode panel — hidden when a table is selected (compact bar in header handles it) */}
            {businessType === "gastronomy" && gastronomyModes.length > 0 && !(serviceMode === "tables" && selectedTableId) ? (
              <div className="mb-4 space-y-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-3">
                <div className="flex flex-wrap gap-2">
                  {gastronomyModes.map((mode) => {
                    const Icon = mode.icon;
                    const active = serviceMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setServiceMode(mode.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-border)]"
                        )}
                      >
                        <Icon className="size-4" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                {serviceMode === "tables" ? null : (
                  <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Mostrador activo: cobro directo y rápido como caja de atención.
                  </div>
                )}
              </div>
            ) : null}
            {catalogMode ? (
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const active = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          active
                            ? "border-[var(--pos-accent)] bg-[var(--pos-accent)] text-white"
                            : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-accent)]/50"
                        )}
                      >
                        {category === "all" ? "Todas" : category}
                      </button>
                    );
                  })}
                </div>
                {businessType === "fashion" && sizes.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => {
                      const active = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-border)]"
                          )}
                        >
                          {size === "all" ? "Todos los talles" : `Talle ${size}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{catalogMode ? "Catálogo" : "Productos"}</div>
              <div className="text-xs text-muted-foreground">
                Mostrando {visible.length} / {filteredCount}
              </div>
            </div>
            <ProductGrid
              products={visible}
              onAdd={addProduct}
              onLoadMore={loadMore}
              hasMore={hasMore}
              mode={catalogMode ? "catalog" : "table"}
              lastAddedProductId={cart.lastAddedProductId}
              onConsumeLastAdded={cart.consumeLastAdded}
            />
          </div>
        }
        right={
          <div className={cn("relative min-h-0 h-full", posGuideActive && "z-[82]")}>
            <CartPanel
              guidePanelRef={cartPanelGuideRef}
              guideCobrarRef={cobrarGuideRef}
              items={cart.items}
              total={cart.total}
              contextLabel={cartContextLabel}
              pending={pending}
              onInc={cart.inc}
              onDec={cart.dec}
              onSetQty={cart.setQty}
              onRemove={cart.remove}
              onOpenPayment={openPayment}
              onFocusScanner={() => searchRef.current?.focus()}
              lastAddedProductId={cart.lastAddedProductId}
            />
          </div>
        }
      />
      )}

      <BarcodeScanner
        open={scannerOpen}
        continuous={isMobilePos}
        steppedAfterSuccess={isMobilePos}
        getCartQuantityForProduct={getCartQuantityForProduct}
        onAdjustCartQuantity={onAdjustCartQuantityFromScanner}
        onClose={() => setScannerOpen(false)}
        onDecoded={(code) => procesarCodigo(code, { silentToast: isMobilePos })}
      />

      <PaymentModal
        open={paymentOpen}
        total={cart.total}
        items={cart.items}
        business={business}
        pending={pending}
        defaultMethod={defaultPaymentMethod}
        paymentMethodConfig={paymentMethodConfig}
        customers={posCustomers}
        mercadoPagoQrReady={mercadoPagoQrReady}
        onClose={closePayment}
        onConfirm={onConfirmPayment}
        onMercadoPagoAutoPaid={onMercadoPagoAutoPaid}
      />

      {/* Notes modal for table orders */}
      {notesModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNotesModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--pos-surface)] p-5 shadow-2xl">
            <h3 className="mb-1 text-sm font-bold text-foreground">Notas del pedido</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Extras, alergias, preferencias, postre, café…
            </p>
            <textarea
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              placeholder="Ej: sin cebolla, sin TACC, traer pan extra…"
              rows={4}
              autoFocus
              className="flex w-full rounded-lg border border-input bg-[var(--pos-surface-2)] px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setNotesModalOpen(false)}
              >
                Listo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
