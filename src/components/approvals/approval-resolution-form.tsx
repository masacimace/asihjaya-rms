"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, X } from "lucide-react";

import {
  approveApprovalAction,
  rejectApprovalAction,
} from "@/app/actions/approvals";
import {
  initialAdminApprovalActionState,
  type AdminApprovalRow,
} from "@/features/approvals/contracts";
import { cn } from "@/lib/utils";

type ApprovalResolutionFormProps = {
  approval: Pick<AdminApprovalRow, "id" | "status">;
  mode: "compact" | "full";
};

function SubmitButton({
  intent,
  mode,
}: {
  intent: "approve" | "reject";
  mode: "compact" | "full";
}) {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : intent === "approve" ? Check : X;

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        mode === "compact" && "h-9 flex-1 px-3 text-xs",
        intent === "approve"
          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-700"
          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
      )}
    >
      <Icon className={cn("size-4", pending && "animate-spin")} />
      {intent === "approve" ? "Setujui" : "Tolak"}
    </button>
  );
}

export function ApprovalResolutionForm({
  approval,
  mode,
}: ApprovalResolutionFormProps) {
  const [approveState, approveFormAction] = useActionState(
    approveApprovalAction,
    initialAdminApprovalActionState,
  );
  const [rejectState, rejectFormAction] = useActionState(
    rejectApprovalAction,
    initialAdminApprovalActionState,
  );

  if (approval.status !== "pending") {
    return null;
  }

  return (
    <div className={cn("space-y-3", mode === "compact" && "space-y-2")}> 
      <form action={approveFormAction} className="space-y-2">
        <input type="hidden" name="approvalId" value={approval.id} />
        {mode === "full" ? (
          <textarea
            name="responseNotes"
            rows={2}
            placeholder="Catatan persetujuan opsional, misalnya: sudah dikonfirmasi manager."
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
        ) : null}
        <SubmitButton intent="approve" mode={mode} />
        {approveState.status === "error" && approveState.message ? (
          <p className="text-xs font-medium text-red-600">
            {approveState.message}
          </p>
        ) : null}
      </form>

      <form action={rejectFormAction} className="space-y-2">
        <input type="hidden" name="approvalId" value={approval.id} />
        <textarea
          name="responseNotes"
          rows={mode === "compact" ? 2 : 3}
          placeholder={
            mode === "compact"
              ? "Alasan tolak wajib diisi"
              : "Alasan penolakan wajib diisi agar audit trail jelas."
          }
          className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
        />
        <SubmitButton intent="reject" mode={mode} />
        {rejectState.status === "error" && rejectState.message ? (
          <p className="text-xs font-medium text-red-600">
            {rejectState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
