"use client";

import * as React from "react";

export type PosProduct = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  size?: string | null;
  color?: string | null;
  image_url?: string | null;
  sold_by_weight: boolean;
  stock: number;
  stock_decimal: number;
  barcode?: string | null;
  scale_code?: string | null;
};

export function useProducts(products: PosProduct[]) {
  const [query, setQueryState] = React.useState("");
  const [selectedCategory, setSelectedCategoryState] = React.useState("all");
  const [selectedSize, setSelectedSizeState] = React.useState("all");
  const [visibleCount, setVisibleCount] = React.useState(48);

  const normalizedQuery = query.trim().toLowerCase();
  const categories = React.useMemo(() => {
    const unique = new Set<string>();
    for (const product of products) {
      const category = String(product.category ?? "").trim();
      if (category) unique.add(category);
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b, "es-AR"))];
  }, [products]);

  const sizes = React.useMemo(() => {
    const unique = new Set<string>();
    for (const product of products) {
      const size = String(product.size ?? "").trim();
      if (size) unique.add(size);
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }))];
  }, [products]);

  const filtered = React.useMemo(() => {
    if (normalizedQuery) {
      return products.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(normalizedQuery);
        const categoryMatch = (p.category ?? "").toLowerCase().includes(normalizedQuery);
        const sizeMatch = (p.size ?? "").toLowerCase().includes(normalizedQuery);
        const colorMatch = (p.color ?? "").toLowerCase().includes(normalizedQuery);
        const barcodeMatch = (p.barcode ?? "").toLowerCase() === normalizedQuery;
        const scaleCodeMatch = (p.scale_code ?? "").toLowerCase() === normalizedQuery;
        return nameMatch || categoryMatch || sizeMatch || colorMatch || barcodeMatch || scaleCodeMatch;
      });
    }

    const categoryFiltered =
      selectedCategory === "all"
        ? products
        : products.filter((p) => String(p.category ?? "").trim() === selectedCategory);

    return selectedSize === "all"
      ? categoryFiltered
      : categoryFiltered.filter((p) => String(p.size ?? "").trim() === selectedSize);

  }, [products, normalizedQuery, selectedCategory, selectedSize]);

  const visible = React.useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const setQuery = React.useCallback((value: string) => {
    setVisibleCount(48);
    setQueryState(value);
  }, []);

  const setSelectedCategory = React.useCallback((value: string) => {
    setVisibleCount(48);
    setSelectedCategoryState(value);
  }, []);

  const setSelectedSize = React.useCallback((value: string) => {
    setVisibleCount(48);
    setSelectedSizeState(value);
  }, []);

  const loadMore = React.useCallback(() => {
    setVisibleCount((c) => Math.min(c + 48, filtered.length));
  }, [filtered.length]);

  const findByBarcodeOrName = React.useCallback(
    (q: string) => {
      const trimmed = q.trim().toLowerCase();
      if (!trimmed) return null;

      const digitsOnly = trimmed.replace(/\s+/g, "");

      const byBarcode = products.find(
        (p) => (p.barcode ?? "").replace(/\s+/g, "").toLowerCase() === digitsOnly
      );
      if (byBarcode) return byBarcode;

      const byScaleCode = products.find((p) => (p.scale_code ?? "").toLowerCase() === trimmed);
      if (byScaleCode) return byScaleCode;

      const byName = products.find((p) => p.name.toLowerCase().includes(trimmed));
      return byName ?? null;
    },
    [products]
  );

  return {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSize,
    setSelectedSize,
    categories,
    sizes,
    filteredCount: filtered.length,
    visible,
    visibleCount,
    loadMore,
    findByBarcodeOrName,
  };
}
