"use client";

import { useCallback, useState, useTransition } from "react";

import type {
  PosHeldCartActionResult,
  PosHoldCartPayload,
} from "@/features/pos/contracts";
import {
  getHeldCartDraftValidationMessage,
  getHeldCartErrorMessage,
} from "@/features/pos/held-cart-state";

type HoldCart = (
  payload: PosHoldCartPayload,
) => Promise<PosHeldCartActionResult>;

export function usePosHeldCart({ holdCart }: { holdCart: HoldCart }) {
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdTitleInput, setHoldTitleInput] = useState("");
  const [holdNoteInput, setHoldNoteInput] = useState("");
  const [holdFeedback, setHoldFeedback] = useState<string | null>(null);
  const [isHoldPending, startHoldTransition] = useTransition();

  const openHoldDialog = useCallback(
    ({
      canHoldCart,
      disabledReason,
      defaultTitle,
      onUnavailable,
    }: {
      canHoldCart: boolean;
      disabledReason: string;
      defaultTitle: string;
      onUnavailable: (message: string) => void;
    }) => {
      if (!canHoldCart) {
        onUnavailable(disabledReason);
        return;
      }

      setHoldTitleInput(defaultTitle);
      setHoldNoteInput("");
      setHoldFeedback(null);
      setIsHoldDialogOpen(true);
    },
    [],
  );

  const closeHoldDialog = useCallback(() => {
    if (isHoldPending) {
      return;
    }

    setIsHoldDialogOpen(false);
    setHoldFeedback(null);
  }, [isHoldPending]);

  const holdCurrentCart = useCallback(
    ({
      canHoldCart,
      disabledReason,
      itemIds,
      customerId,
      onSuccess,
    }: {
      canHoldCart: boolean;
      disabledReason: string;
      itemIds: string[];
      customerId: string | null;
      onSuccess: (result: Extract<PosHeldCartActionResult, { status: "success" }>) => void;
    }) => {
      if (!canHoldCart) {
        setHoldFeedback(disabledReason);
        return;
      }

      const validationMessage = getHeldCartDraftValidationMessage({
        title: holdTitleInput,
        note: holdNoteInput,
      });

      if (validationMessage) {
        setHoldFeedback(validationMessage);
        return;
      }

      setHoldFeedback(null);

      startHoldTransition(async () => {
        const result = await holdCart({
          itemIds,
          customerId,
          title: holdTitleInput,
          note: holdNoteInput,
        });

        if (result.status === "error") {
          setHoldFeedback(getHeldCartErrorMessage(result));
          return;
        }

        setIsHoldDialogOpen(false);
        setHoldTitleInput("");
        setHoldNoteInput("");
        onSuccess(result);
      });
    },
    [holdCart, holdNoteInput, holdTitleInput],
  );

  return {
    isHoldDialogOpen,
    holdTitleInput,
    setHoldTitleInput,
    holdNoteInput,
    setHoldNoteInput,
    holdFeedback,
    isHoldPending,
    openHoldDialog,
    closeHoldDialog,
    holdCurrentCart,
  };
}
