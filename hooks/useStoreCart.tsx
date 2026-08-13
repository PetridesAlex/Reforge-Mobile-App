import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { trackStoreEvent } from '@/lib/store/analytics';
import { useSupabaseStore } from '@/lib/store/config';
import * as commerce from '@/services/store.commerce';
import * as store from '@/services/store';
import type { StoreCartLine, StoreCartValidationIssue } from '@/types';

type AddInput = {
  product_id: string;
  variant_id: string;
  product_name: string;
  size_label: string | null;
  color_label: string | null;
  sku: string | null;
  unit_price_cents: number;
  image_url: string | null;
  quantity?: number;
};

type StoreCartContextValue = {
  lines: StoreCartLine[];
  count: number;
  subtotalCents: number;
  issues: StoreCartValidationIssue[];
  hydrated: boolean;
  addItem: (input: AddInput) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
  validate: () => Promise<StoreCartValidationIssue[]>;
  replaceLines: (lines: StoreCartLine[]) => Promise<void>;
};

const StoreCartContext = createContext<StoreCartContextValue | null>(null);

function storageKey(userId: string) {
  return `reforge.store.cart.${userId}`;
}

export function StoreCartProvider({
  userId,
  children,
}: {
  userId?: string | null;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<StoreCartLine[]>([]);
  const [issues, setIssues] = useState<StoreCartValidationIssue[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const resolvingImages = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setLines([]);
        setHydrated(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        const local: StoreCartLine[] = raw ? JSON.parse(raw) : [];
        if (cancelled) return;
        setLines(local);
        if (useSupabaseStore()) {
          const remote = await commerce.pullCart(userId).catch(() => null);
          if (!cancelled && remote && remote.length) {
            const merged = remote.map((r) => ({
              ...r,
              image_url:
                r.image_url ??
                local.find((l) => l.variant_id === r.variant_id)?.image_url ??
                null,
            }));
            setLines(merged);
            await AsyncStorage.setItem(storageKey(userId), JSON.stringify(merged));
          } else if (!cancelled && local.length) {
            await commerce.pushCart(userId, local).catch(() => undefined);
          }
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Backfill product images for cart lines that lost / never had a thumbnail. */
  useEffect(() => {
    if (!hydrated || !userId || resolvingImages.current) return;
    const missing = lines.filter((l) => !l.image_url);
    if (!missing.length) return;

    resolvingImages.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const productIds = [...new Set(missing.map((l) => l.product_id))];
        const entries = await Promise.all(
          productIds.map(async (id) => {
            const product = await store.getProduct(id).catch(() => null);
            return [id, product?.primary_image_url ?? null] as const;
          }),
        );
        const byProduct = Object.fromEntries(entries);
        if (cancelled) return;

        let changed = false;
        const next = lines.map((l) => {
          if (l.image_url) return l;
          const uri = byProduct[l.product_id];
          if (!uri) return l;
          changed = true;
          return { ...l, image_url: uri };
        });
        if (changed) {
          setLines(next);
          await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
        }
      } finally {
        resolvingImages.current = false;
      }
    })();

    return () => {
      cancelled = true;
      resolvingImages.current = false;
    };
  }, [hydrated, lines, userId]);

  const persist = useCallback(
    async (next: StoreCartLine[]) => {
      setLines(next);
      if (!userId) return;
      await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
      if (useSupabaseStore()) {
        await commerce.pushCart(userId, next).catch(() => undefined);
      }
    },
    [userId],
  );

  const addItem = useCallback(
    async (input: AddInput) => {
      const qty = input.quantity ?? 1;
      const existing = lines.find((l) => l.variant_id === input.variant_id);
      const next = existing
        ? lines.map((l) =>
            l.variant_id === input.variant_id
              ? {
                  ...l,
                  quantity: l.quantity + qty,
                  unit_price_cents: input.unit_price_cents,
                  image_url: input.image_url ?? l.image_url,
                }
              : l,
          )
        : [
            ...lines,
            {
              id: `local-${input.variant_id}`,
              product_id: input.product_id,
              variant_id: input.variant_id,
              product_name: input.product_name,
              size_label: input.size_label,
              color_label: input.color_label,
              sku: input.sku,
              unit_price_cents: input.unit_price_cents,
              quantity: qty,
              image_url: input.image_url,
            },
          ];
      trackStoreEvent('add_to_cart', { product_id: input.product_id, quantity: qty });
      await persist(next);
    },
    [lines, persist],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        const next = lines.filter((l) => l.variant_id !== variantId);
        trackStoreEvent('remove_from_cart', { variant_id: variantId });
        await persist(next);
        return;
      }
      await persist(lines.map((l) => (l.variant_id === variantId ? { ...l, quantity } : l)));
    },
    [lines, persist],
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      trackStoreEvent('remove_from_cart', { variant_id: variantId });
      await persist(lines.filter((l) => l.variant_id !== variantId));
    },
    [lines, persist],
  );

  const clear = useCallback(async () => {
    await persist([]);
    setIssues([]);
  }, [persist]);

  const replaceLines = useCallback(
    async (next: StoreCartLine[]) => {
      await persist(next);
    },
    [persist],
  );

  const validate = useCallback(async () => {
    const result = await commerce.validateCart(lines);
    setIssues(result.issues);
    if (result.lines.length) {
      const mapped: StoreCartLine[] = result.lines.map((l) => ({
        id: `local-${l.variant_id}`,
        product_id: l.product_id,
        variant_id: l.variant_id,
        product_name: l.product_name,
        size_label: l.size_label,
        color_label: l.color_label,
        sku: l.sku,
        unit_price_cents: l.unit_price_cents,
        quantity: l.quantity,
        image_url:
          l.image_url ?? lines.find((prev) => prev.variant_id === l.variant_id)?.image_url ?? null,
      }));
      await persist(mapped);
    }
    return result.issues;
  }, [lines, persist]);

  const value = useMemo<StoreCartContextValue>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotalCents: lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0),
      issues,
      hydrated,
      addItem,
      setQuantity,
      removeItem,
      clear,
      validate,
      replaceLines,
    }),
    [
      lines,
      issues,
      hydrated,
      addItem,
      setQuantity,
      removeItem,
      clear,
      validate,
      replaceLines,
    ],
  );

  return <StoreCartContext.Provider value={value}>{children}</StoreCartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(StoreCartContext);
  if (!ctx) throw new Error('useStoreCart must be used within StoreCartProvider');
  return ctx;
}
