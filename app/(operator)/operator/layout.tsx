import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  getOperatorClaims,
  getVerifiedClaims,
} from "@/application/auth/verified-claims";
import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";
import { OperatorHeader } from "@/app/(operator)/operator/operator-header";

export default async function OperatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!getOperatorClaims(await getVerifiedClaims())) redirect("/login");
  const { restaurants, activeRestaurant } = await getActiveRestaurantContext();

  return (
    <div className="min-h-screen bg-stone-50">
      <OperatorHeader
        activeRestaurant={activeRestaurant}
        restaurants={restaurants}
      />
      {children}
    </div>
  );
}
