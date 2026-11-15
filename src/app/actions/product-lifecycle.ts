"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ProductLifecycleEntity, ProductLifecycleOperation, ProductLifecycleResult } from "@/features/products/lifecycle-contracts";
import { changeProductLifecycle, ProductLifecycleError } from "@/features/products/lifecycle-service";
import { requireAnyPermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

export async function changeProductLifecycleAction(
  entity: ProductLifecycleEntity, id: string, operation: ProductLifecycleOperation,
): Promise<ProductLifecycleResult> {
  if (entity !== "item" && entity !== "master") return {status:"error",message:"Jenis produk tidak valid."};
  const auth = await requireAnyPermission(entity === "master" ? ["products.manage"] : ["inventory.adjust", "inventory.manage"]);
  const headerStore = await headers();
  let result;
  try {
    result = await changeProductLifecycle({auth,entity,id,operation,requestMetadata:{ipAddress:getClientIp(headerStore),userAgent:headerStore.get("user-agent")}});
  } catch (error) {
    if (!(error instanceof ProductLifecycleError)) console.error("Gagal mengelola produk",error);
    return {status:"error",message:error instanceof ProductLifecycleError ? error.message : "Produk belum dapat diproses. Muat ulang halaman; riwayat dan keterkaitan produk tetap dipertahankan."};
  }
  for (const path of ["/pos","/admin/produk","/admin/inventaris",`/admin/produk/${result.productId}`,`/admin/inventaris/item/${id}`,`/admin/inventaris/item/${id}/edit`]) revalidatePath(path);
  return {status:"success",deleted:result.deleted,message:operation === "delete" ? "Produk yang belum digunakan berhasil dihapus." : operation === "archive" ? "Produk berhasil diarsipkan. Riwayat tetap tersimpan." : "Produk berhasil dipulihkan dengan status sebelumnya."};
}
