"use client";

import { useEffect, useRef } from "react";

import {
  normalizePosWorkspaceCommand,
  POS_PENDING_COMMAND_STORAGE_KEY,
  POS_WORKSPACE_COMMAND_EVENT,
  type PosWorkspaceCommand,
} from "@/features/pos/workspace-command";

export function usePosWorkspaceCommand(
  onCommand: (command: PosWorkspaceCommand) => void,
) {
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    function handleCommandEvent(event: Event) {
      const command = normalizePosWorkspaceCommand(
        (event as CustomEvent<unknown>).detail,
      );

      if (command) {
        onCommandRef.current(command);
      }
    }

    window.addEventListener(POS_WORKSPACE_COMMAND_EVENT, handleCommandEvent);

    try {
      const pendingCommandValue = window.sessionStorage.getItem(
        POS_PENDING_COMMAND_STORAGE_KEY,
      );

      if (pendingCommandValue) {
        window.sessionStorage.removeItem(POS_PENDING_COMMAND_STORAGE_KEY);

        const pendingCommand = normalizePosWorkspaceCommand(
          JSON.parse(pendingCommandValue),
        );

        if (pendingCommand) {
          onCommandRef.current(pendingCommand);
        }
      }
    } catch {
      window.sessionStorage.removeItem(POS_PENDING_COMMAND_STORAGE_KEY);
    }

    return () => {
      window.removeEventListener(
        POS_WORKSPACE_COMMAND_EVENT,
        handleCommandEvent,
      );
    };
  }, []);
}
