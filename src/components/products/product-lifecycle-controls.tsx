"use client";

import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeProductLifecycleAction } from "@/app/actions/product-lifecycle";
import type { ProductLifecycleEntity, ProductLifecycleResult, ProductLifecycleState } from "@/features/products/lifecycle-contracts";

export function ProductLifecycleControls({entity,id,state}:{entity:ProductLifecycleEntity;id:string;state:ProductLifecycleState}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const [pending,startTransition] = useTransition();
  const [feedback,setFeedback] = useState<ProductLifecycleResult | null>(null);
  const Icon = state.operation === "delete" ? Trash2 : state.operation === "restore" ? ArchiveRestore : Archive;
  function submit() {
    startTransition(async()=>{
      try {
        const result = await changeProductLifecycleAction(entity,id,state.operation);
        setFeedback(result);
        if (result.status === "success") {
          dialog.current?.close();
          if (result.deleted) router.push(`${entity === "item" ? "/admin/inventaris" : "/admin/produk"}?lifecycle=deleted`);
          router.refresh();
        }
      } catch {
        setFeedback({status:"error",message:"Produk belum dapat diproses. Silakan coba kembali."});
      }
    });
  }
  return <div className="min-w-0 space-y-2">
    <button type="button" disabled={Boolean(state.blockedReason)||pending} title={state.blockedReason??undefined}
      onClick={()=>{setFeedback(null);dialog.current?.showModal();}}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
      <Icon className="size-4"/>{state.label}
    </button>
    {state.blockedReason ? <p className="max-w-sm text-xs leading-5 text-amber-800">{state.blockedReason}</p> : null}
    {feedback?.status === "success" ? <p role="status" className="max-w-sm text-xs text-emerald-800">{feedback.message}</p> : null}
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{if(pending)event.preventDefault();}}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-950 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">{state.label}</h2>
        <button type="button" aria-label="Tutup konfirmasi" disabled={pending} onClick={()=>dialog.current?.close()} className="rounded-lg p-2 hover:bg-neutral-100"><X className="size-4"/></button>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{state.description}</p>
      {feedback?.status === "error" ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{feedback.message}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={pending} onClick={()=>dialog.current?.close()} className="min-h-10 rounded-xl border border-neutral-300 px-4 text-sm font-semibold">Batal</button>
        <button type="button" disabled={pending} onClick={submit} className="min-h-10 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Memproses..." : state.label}</button>
      </div>
    </dialog>
  </div>;
}
