"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/platform/supabase/client";

export function DashboardRealtime({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const channel = supabase
      .channel(`restaurant:${restaurantId}`, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, () => {
        if (!active || refreshTimer.current) return;
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null;
          router.refresh();
        }, 80);
      });

    void supabase.realtime.setAuth().then(() => channel.subscribe());
    return () => {
      active = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return (
    <p className="sr-only" aria-live="polite">
      El dashboard recibe actualizaciones automáticas.
    </p>
  );
}
