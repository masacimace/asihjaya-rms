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
        mode === "compact" && "h-10 w-full px-3 text-sm",
        intent === "approve"
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
      )}
    >
      <Icon className={cn("size-4", pending && "animate-spin")} />
      {intent === "approve" ? "Setujui" : "Tolak"}
    </button>
  );
}

function CompactApprovalResolutionForm({
  approval,
  approveState,
  approveFormAction,
  rejectState,
  rejectFormAction,
}: {
  approval: Pick<AdminApprovalRow, "id" | "status">;
  approveState: typeof initialAdminApprovalActionState;
  approveFormAction: (payload: FormData) => void;
  rejectState: typeof initialAdminApprovalActionState;
  rejectFormAction: (payload: FormData) => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white/75 p-3">
      <div className="grid grid-cols-2 gap-2">
        <form action={approveFormAction} className="contents">
          <input type="hidden" name="approvalId" value={approval.id} />
          <div className="order-2 min-w-0">
            <SubmitButton intent="approve" mode="compact" />
          </div>
          {approveState.status === "error" && approveState.message ? (
            <p className="order-5 col-span-2 text-xs font-medium text-red-600">
              {approveState.message}
            </p>
          ) : null}
        </form>

        <form action={rejectFormAction} className="contents">
          <input type="hidden" name="approvalId" value={approval.id} />
          <textarea
            name="responseNotes"
            rows={3}
            placeholder="Alasan tolak wajib diisi"
            className="order-1 col-span-2 min-h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
          <div className="order-3 min-w-0">
            <SubmitButton intent="reject" mode="compact" />
          </div>
          {rejectState.status === "error" && rejectState.message ? (
            <p className="order-4 col-span-2 text-xs font-medium text-red-600">
              {rejectState.message}
            </p>
          ) : null}
        </form>
      </div>
    </div>
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

  if (mode === "compact") {
    return (
      <CompactApprovalResolutionForm
        approval={approval}
        approveState={approveState}
        approveFormAction={approveFormAction}
        rejectState={rejectState}
        rejectFormAction={rejectFormAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      <form action={approveFormAction} className="space-y-2">
        <input type="hidden" name="approvalId" value={approval.id} />
        <textarea
          name="responseNotes"
          rows={2}
          placeholder="Catatan persetujuan opsional, misalnya: sudah dikonfirmasi manager."
          className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
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
          rows={3}
          placeholder="Alasan penolakan wajib diisi agar audit trail jelas."
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
