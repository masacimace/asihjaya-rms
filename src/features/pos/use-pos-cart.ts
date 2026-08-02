"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { PosAvailableItem } from "@/features/pos/contracts";
import {
  getPosCartItemIds,
  getPosCartSubtotal,
} from "@/features/pos/cart-state";

const CART_FEEDBACK_AUTO_CLOSE_MS = 3_500;

export type UsePosCartResult = {
  cartItems: PosAvailableItem[];
  setCartItems: Dispatch<SetStateAction<PosAvailableItem[]>>;
  cartItemIds: ReadonlySet<string>;
  subtotalAmount: number;
  cartFeedback: string | null;
  setCartFeedback: Dispatch<SetStateAction<string | null>>;
};

export function usePosCart(): UsePosCartResult {
  const [cartItems, setCartItems] = useState<PosAvailableItem[]>([]);
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!cartFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCartFeedback(null);
    }, CART_FEEDBACK_AUTO_CLOSE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cartFeedback]);

  const cartItemIds = useMemo(() => getPosCartItemIds(cartItems), [cartItems]);
  const subtotalAmount = useMemo(
    () => getPosCartSubtotal(cartItems),
    [cartItems],
  );

  return {
    cartItems,
    setCartItems,
    cartItemIds,
    subtotalAmount,
    cartFeedback,
    setCartFeedback,
  };
}
