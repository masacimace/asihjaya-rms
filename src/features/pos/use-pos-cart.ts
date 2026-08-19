"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { PosCartItem } from "@/features/pos/contracts";
import {
  getPosCartItemIds,
  getPosCartSummary,
} from "@/features/pos/cart-state";

const CART_FEEDBACK_AUTO_CLOSE_MS = 3_500;

export type UsePosCartResult = {
  cartItems: PosCartItem[];
  setCartItems: Dispatch<SetStateAction<PosCartItem[]>>;
  cartItemIds: ReadonlySet<string>;
  subtotalAmount: number;
  discountAmount: number;
  laborAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  cartFeedback: string | null;
  setCartFeedback: Dispatch<SetStateAction<string | null>>;
};

export function usePosCart(): UsePosCartResult {
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
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
  const summary = useMemo(() => getPosCartSummary(cartItems), [cartItems]);

  return {
    cartItems,
    setCartItems,
    cartItemIds,
    ...summary,
    cartFeedback,
    setCartFeedback,
  };
}
