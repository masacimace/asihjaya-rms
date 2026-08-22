"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PosAvailableItem,
  PosCatalogCursor,
  PosCatalogPageActionResult,
} from "@/features/pos/contracts";

const POS_CATALOG_SEARCH_DEBOUNCE_MS = 300;

type UsePosCatalogOptions = {
  initialItems: PosAvailableItem[];
  initialCursor: PosCatalogCursor | null;
  initialHasMore: boolean;
  searchQuery: string;
  activeCategoryId: string;
  loadPage: (input: {
    cursor?: PosCatalogCursor | null;
    searchQuery?: string | null;
    categoryId?: string | null;
  }) => Promise<PosCatalogPageActionResult>;
};

function mergeUniqueCatalogItems(
  currentItems: PosAvailableItem[],
  incomingItems: PosAvailableItem[],
) {
  const seenIds = new Set(currentItems.map((item) => item.id));
  const mergedItems = [...currentItems];

  for (const item of incomingItems) {
    if (seenIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    mergedItems.push(item);
  }

  return mergedItems;
}

export function usePosCatalog({
  initialItems,
  initialCursor,
  initialHasMore,
  searchQuery,
  activeCategoryId,
  loadPage,
}: UsePosCatalogOptions) {
  const [catalogItems, setCatalogItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<PosCatalogCursor | null>(
    initialCursor,
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    searchQuery.trim(),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const isFirstFilterEffectRef = useRef(true);
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    if (activeCategoryId !== "all" || debouncedSearchQuery) {
      return;
    }

    requestVersionRef.current += 1;
    isLoadingMoreRef.current = false;
    setCatalogItems(initialItems);
    setNextCursor(initialCursor);
    setHasMore(initialHasMore);
    setCatalogError(null);
    setIsRefreshing(false);
    setIsLoadingMore(false);
  }, [
    activeCategoryId,
    debouncedSearchQuery,
    initialCursor,
    initialHasMore,
    initialItems,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, POS_CATALOG_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (isFirstFilterEffectRef.current) {
      isFirstFilterEffectRef.current = false;
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    const categoryId = activeCategoryId === "all" ? null : activeCategoryId;

    setCatalogItems([]);
    setNextCursor(null);
    setHasMore(false);
    setCatalogError(null);
    setIsRefreshing(true);
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);

    void loadPage({
      cursor: null,
      searchQuery: debouncedSearchQuery || null,
      categoryId,
    })
      .then((result) => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        if (result.status === "error") {
          setCatalogError(result.message);
          return;
        }

        setCatalogItems(result.items);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch(() => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setCatalogError(
          "Katalog POS belum bisa dimuat. Ubah pencarian atau kategori untuk mencoba lagi.",
        );
      })
      .finally(() => {
        if (requestVersion === requestVersionRef.current) {
          setIsRefreshing(false);
        }
      });
  }, [activeCategoryId, debouncedSearchQuery, loadPage]);

  const loadMore = useCallback(() => {
    if (
      isRefreshing ||
      isLoadingMoreRef.current ||
      !hasMore ||
      !nextCursor
    ) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    const categoryId = activeCategoryId === "all" ? null : activeCategoryId;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setCatalogError(null);

    void loadPage({
      cursor: nextCursor,
      searchQuery: debouncedSearchQuery || null,
      categoryId,
    })
      .then((result) => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        if (result.status === "error") {
          setCatalogError(result.message);
          return;
        }

        setCatalogItems((currentItems) =>
          mergeUniqueCatalogItems(currentItems, result.items),
        );
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch(() => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setCatalogError(
          "Produk berikutnya belum bisa dimuat. Scroll sedikit ke atas lalu kembali ke bawah untuk mencoba lagi.",
        );
      })
      .finally(() => {
        if (requestVersion === requestVersionRef.current) {
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      });
  }, [
    activeCategoryId,
    debouncedSearchQuery,
    hasMore,
    isRefreshing,
    loadPage,
    nextCursor,
  ]);

  return {
    catalogItems,
    debouncedSearchQuery,
    hasMore,
    isRefreshing,
    isLoadingMore,
    catalogError,
    loadMore,
  };
}
