"use client";

import * as React from "react";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);
}

function productSearchHaystack(product: PosProduct): string {
  return normalizeSearchText(
    [product.name, product.category, product.size, product.color, product.barcode, product.scale_code]
      .filter(Boolean)
      .join(" ")
  );
}

function matchesProductSearch(product: PosProduct, tokens: string[], rawQuery: string): boolean {
  if (tokens.length === 0) return true;

  const digitsOnly = rawQuery.replace(/\s+/g, "").toLowerCase();
  if (digitsOnly) {
    const barcode = (product.barcode ?? "").replace(/\s+/g, "").toLowerCase();
    const scaleCode = (product.scale_code ?? "").toLowerCase();
    if (barcode === digitsOnly || scaleCode === digitsOnly) return true;
  }

  const haystack = productSearchHaystack(product);
  return tokens.every((token) => haystack.includes(token));
}

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

  const searchTokens = React.useMemo(() => tokenizeSearchQuery(query), [query]);
  const hasSearchQuery = searchTokens.length > 0;
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
    if (hasSearchQuery) {
      return products.filter((p) => matchesProductSearch(p, searchTokens, query));
    }

    const categoryFiltered =
      selectedCategory === "all"
        ? products
        : products.filter((p) => String(p.category ?? "").trim() === selectedCategory);

    return selectedSize === "all"
      ? categoryFiltered
      : categoryFiltered.filter((p) => String(p.size ?? "").trim() === selectedSize);

  }, [products, hasSearchQuery, searchTokens, query, selectedCategory, selectedSize]);

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
      const trimmed = q.trim();
      if (!trimmed) return null;

      const tokens = tokenizeSearchQuery(trimmed);
      if (tokens.length === 0) return null;

      const digitsOnly = trimmed.replace(/\s+/g, "").toLowerCase();

      const byBarcode = products.find(
        (p) => (p.barcode ?? "").replace(/\s+/g, "").toLowerCase() === digitsOnly
      );
      if (byBarcode) return byBarcode;

      const byScaleCode = products.find((p) => (p.scale_code ?? "").toLowerCase() === trimmed.toLowerCase());
      if (byScaleCode) return byScaleCode;

      const byName = products.find((p) => matchesProductSearch(p, tokens, trimmed));
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
