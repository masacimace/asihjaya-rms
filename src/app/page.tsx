import { redirect } from "next/navigation";

import { getCurrentAuth, getDefaultRoute } from "@/lib/auth/session";

export default async function HomePage() {
  const auth = await getCurrentAuth();

  if (!auth) {
    redirect("/login");
  }

  redirect(getDefaultRoute(auth.permissionCodes));
}
