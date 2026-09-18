"use client";

import { Trash2 } from "lucide-react";

import {
  deleteFailedHardwareJobAction,
  purgeInactiveHardwareAgentAction,
} from "@/app/actions/hardware-cleanup";

export function DeleteFailedHardwareJobButton({
  jobId,
}: {
  jobId: string;
}) {
  return (
    <form
      action={deleteFailedHardwareJobAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Hapus hardware job gagal ini? Riwayat attempt ikut terhapus dan tindakan ini tidak dapat dibatalkan.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        <Trash2 className="size-3.5" />
        Hapus
      </button>
    </form>
  );
}

export function PurgeInactiveHardwareAgentButton({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  return (
    <form
      action={purgeInactiveHardwareAgentAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Hapus permanen ${agentName}? Sistem akan menolak jika perangkat masih memiliki dependency atau riwayat audit yang wajib dipertahankan.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="agentId" value={agentId} />
      <button
        type="submit"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 sm:w-auto"
      >
        <Trash2 className="size-4" />
        Hapus Permanen
      </button>
    </form>
  );
}
