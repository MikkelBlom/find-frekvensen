"use client";

import { usePalette } from "@/lib/usePalette";
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
  const p = usePalette();
  return (
    <div className="flex items-center justify-center" style={{ gap: "1.5cqmin" }}>
      {items.map((item) => {
        const found = item.foundAtMs != null && item.payload !== "";
        return (
          <div
            key={item.id}
            className="flex items-center justify-center"
            style={{
              width: big ? "13cqmin" : "9cqmin",
              height: big ? "16cqmin" : "11cqmin",
              fontSize: big ? "10cqmin" : "7cqmin",
              fontWeight: 900,
              borderRadius: "1.6cqmin",
              background: found ? p.found : p.trayEmpty,
              color: found ? p.foundText : p.trayEmptyBorder,
              border: `0.5cqmin solid ${found ? p.foundGlow : p.trayEmptyBorder}`,
              boxShadow: found ? `0 0 2.4cqmin ${accent}44` : "none",
            }}
          >
            <span key={item.foundAtMs ?? "empty"} className={found ? "reveal-pop" : ""}>
              {found ? item.payload : "·"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
