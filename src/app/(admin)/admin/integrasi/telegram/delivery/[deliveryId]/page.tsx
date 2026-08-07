import { redirect } from "next/navigation";

export default async function LegacyTelegramDeliveryDetailPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const { deliveryId } = await params;
  redirect(
    `/admin/pengaturan/integrasi/telegram/delivery/${encodeURIComponent(deliveryId)}`,
  );
}
