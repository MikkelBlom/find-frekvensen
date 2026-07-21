"use client";

import { tokens } from "@/game/tokens";
import type { RevealItem } from "@/game/types";

/**
 * Word-mode collected-letters tray. One slot per station, in message order.
 * Found letters pop in; unfound slots are calm placeholders so a child can see
 * how many are left to find.
 */
export function MessageTray({
  items,
  accent,
  big = false,
}: {
  items: RevealItem[];
  accent: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-center" style={{ gap: "1.5cqmin" }}>
      {items.map((item) => {
        const found = item.foundAtMs != null && item.payload !== "";
        return (
          <div
            key={item.id}
            className="flex items-center justify-center font-black"
            style={{
              width: big ? "13cqmin" : "9cqmin",
              height: big ? "16cqmin" : "11cqmin",
              fontSize: big ? "10cqmin" : "7cqmin",
              borderRadius: "1.6cqmin",
              background: found ? tokens.stationFound : tokens.trayEmpty,
              color: found ? "#2a1c12" : tokens.trayEmptyBorder,
              border: `0.5cqmin solid ${found ? tokens.stationFoundGlow : tokens.trayEmptyBorder}`,
              boxShadow: found ? `0 0 3cqmin ${accent}55` : "none",
            }}
          >
            <span
              key={item.foundAtMs ?? "empty"}
              className={found ? "reveal-pop" : ""}
            >
              {found ? item.payload : "•"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
