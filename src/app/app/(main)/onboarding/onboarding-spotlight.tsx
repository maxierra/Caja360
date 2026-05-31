"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Props = {
  active: boolean;
  targetRef: React.RefObject<Element | null>;
  stepIndex: number;
  totalSteps: number;
  title: string;
  description: React.ReactNode;
  /** z-index base para cubrir sidebar/layout; el objetivo debe ir ~+2 por encima del contenido */
  stackBase?: number;
  /** Incrementá cuando el elemento objetivo cambie sin cambiar la ref (ej. mismo ref objeto, otro nodo). */
  remeasureSignal?: number;
  /** Si false, no oscurece el fondo; solo resalta el objetivo y muestra la ayuda. */
  dimBackground?: boolean;
};

/**
 * Oscurece y difumina el resto de la pantalla dejando un “hueco” alrededor del elemento objetivo.
 * Se monta con portal en `document.body` para cubrir header/sidebar aunque un ancestro cree stacking context.
 */
export function OnboardingSpotlight({
  active,
  targetRef,
  stepIndex,
  totalSteps,
  title,
  description,
  stackBase = 80,
  remeasureSignal = 0,
  dimBackground = true,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [box, setBox] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const measure = React.useCallback(() => {
    const el = targetRef.current;
    if (!active || !el) {
      setBox(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      setBox(null);
      return;
    }
    const pad = 14;
    setBox({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
  }, [active, targetRef]);

  React.useLayoutEffect(() => {
    measure();
    const el = targetRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el as Element);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure, active, remeasureSignal]);

  if (!active || !mounted || typeof document === "undefined") return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  const shade =
    "pointer-events-auto bg-neutral-950/70 backdrop-blur-xl dark:bg-black/72 dark:backdrop-blur-xl";

  const zOverlay = stackBase;
  const zHint = stackBase + 1;

  const portalTarget = document.body;

  const topH = box ? Math.max(0, box.top) : 0;
  const bottomTop = box ? box.top + box.height : 0;
  const bottomH = box ? Math.max(0, vh - bottomTop) : 0;
  const leftW = box ? Math.max(0, box.left) : 0;
  const rightLeft = box ? box.left + box.width : 0;
  const rightW = box ? Math.max(0, vw - rightLeft) : 0;

  const dimPanels = !dimBackground
    ? null
    : box !== null ? (
        <>
          {topH > 0 ? <div className={cn("fixed left-0 right-0 top-0", shade)} style={{ height: topH }} /> : null}
          {bottomH > 0 ? (
            <div className={cn("fixed left-0 right-0", shade)} style={{ top: bottomTop, height: bottomH }} />
          ) : null}
          {box.height > 0 && leftW > 0 ? (
            <div
              className={cn("fixed", shade)}
              style={{ top: box.top, left: 0, width: leftW, height: box.height }}
            />
          ) : null}
          {box.height > 0 && rightW > 0 ? (
            <div
              className={cn("fixed", shade)}
              style={{ top: box.top, left: rightLeft, width: rightW, height: box.height }}
            />
          ) : null}
        </>
      ) : (
        <div className={cn("fixed inset-0", shade)} />
      );

  const overlay = (
    <>
      {dimPanels ? (
        <div className="fixed inset-0" style={{ zIndex: zOverlay }} aria-hidden>
          {dimPanels}
        </div>
      ) : null}

      {!dimBackground && box ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed rounded-xl border-2 border-emerald-400/90 bg-emerald-500/10 shadow-[0_0_0_3px_rgba(16,185,129,0.35),0_10px_30px_-15px_rgba(16,185,129,0.6)]"
          style={{
            zIndex: zOverlay,
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
          aria-hidden
        />
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl border-2 border-emerald-400/50 bg-card/98 p-4 shadow-2xl shadow-black/25 backdrop-blur-md"
        style={{ zIndex: zHint }}
        role="status"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Paso {stepIndex} de {totalSteps}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-colors",
                    n < stepIndex && "bg-emerald-500",
                    n === stepIndex && "bg-emerald-400 ring-2 ring-emerald-500/50",
                    n > stepIndex && "bg-muted"
                  )}
                />
              );
            })}
          </div>
        </div>
        <h2 className="font-serif text-lg font-semibold tracking-tight">{title}</h2>
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</div>
      </motion.div>
    </>
  );

  return createPortal(overlay, portalTarget);
}
