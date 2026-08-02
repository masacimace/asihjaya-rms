"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import type {
  PosAvailableItem,
  PosScanLookupResult,
} from "@/features/pos/contracts";
import { usePosWorkspaceCommand } from "@/features/pos/use-pos-workspace-command";
import {
  getPosWorkspaceCommandIntent,
  type PosWorkspaceCommand,
} from "@/features/pos/workspace-command";

type UsePosScannerOptions = {
  lookupScanValue: (scanValue: string) => Promise<PosScanLookupResult>;
  onItemFound: (item: PosAvailableItem) => void;
  onFeedback: (message: string | null) => void;
};

export function usePosScanner({
  lookupScanValue,
  onItemFound,
  onFeedback,
}: UsePosScannerOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanLookupPending, startScanLookupTransition] = useTransition();
  const callbackRef = useRef({ onItemFound, onFeedback });

  useEffect(() => {
    callbackRef.current = { onItemFound, onFeedback };
  }, [onFeedback, onItemFound]);

  const lookupScannedItem = useCallback(
    (scanValue: string) => {
      const normalizedScanValue = scanValue.trim();

      if (!normalizedScanValue) {
        callbackRef.current.onFeedback(
          "Masukkan barcode, QR value, serial number, atau SKU item.",
        );
        return;
      }

      setIsScannerOpen(false);
      setSearchQuery(normalizedScanValue);
      callbackRef.current.onFeedback(
        `Mencari item ${normalizedScanValue}...`,
      );

      startScanLookupTransition(async () => {
        const result = await lookupScanValue(normalizedScanValue);

        if (result.status === "found") {
          callbackRef.current.onItemFound(result.item);
          return;
        }

        callbackRef.current.onFeedback(result.message);
      });
    },
    [lookupScanValue],
  );

  const handleWorkspaceCommand = useCallback(
    (command: PosWorkspaceCommand) => {
      const intent = getPosWorkspaceCommandIntent(command);

      if (intent.type === "clear_search") {
        setIsScannerOpen(false);
        setSearchQuery("");
        callbackRef.current.onFeedback(null);
        return;
      }

      if (intent.type === "scan") {
        lookupScannedItem(intent.value);
        return;
      }

      setIsScannerOpen(false);
      setSearchQuery(intent.value);
      callbackRef.current.onFeedback(`Filter katalog: ${intent.value}`);
    },
    [lookupScannedItem],
  );

  usePosWorkspaceCommand(handleWorkspaceCommand);

  return {
    searchQuery,
    setSearchQuery,
    isScannerOpen,
    setIsScannerOpen,
    isScanLookupPending,
    lookupScannedItem,
  };
}
