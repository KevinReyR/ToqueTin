"use client";

import { useTransition } from "react";

import {
  selectRestaurantAction,
  signOutAction,
} from "@/app/(operator)/operator/actions";
import type { OperatorRestaurant } from "@/domain/restaurants/types";
import { Button } from "@/ui";

interface OperatorHeaderProps {
  restaurants: OperatorRestaurant[];
  activeRestaurant: OperatorRestaurant | null;
}

export function OperatorHeader({
  restaurants,
  activeRestaurant,
}: OperatorHeaderProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="no-print border-b border-stone-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a className="font-bold tracking-tight text-stone-950" href="/operator">
          ToqueTin
        </a>
        <div className="flex items-center gap-2">
          {activeRestaurant ? (
            <form
              onChange={(event) => {
                const formData = new FormData(event.currentTarget);
                startTransition(async () => {
                  await selectRestaurantAction(formData);
                });
              }}
            >
              <label className="sr-only" htmlFor="active-restaurant">
                Restaurante activo
              </label>
              <select
                aria-label="Restaurante activo"
                className="min-h-11 max-w-48 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 focus:outline-2 focus:outline-offset-2 focus:outline-amber-700 disabled:opacity-60"
                defaultValue={activeRestaurant.id}
                disabled={pending}
                id="active-restaurant"
                name="restaurantId"
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
              <span className="sr-only" role="status">
                {pending ? "Cambiando restaurante" : ""}
              </span>
            </form>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="quiet">
              Salir
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
