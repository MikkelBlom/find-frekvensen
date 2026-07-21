"use client";

import { getPicture } from "@/game/pictures";
import { tokens } from "@/game/tokens";

/**
 * Image-mode reveal. The picture SVG is used as a CSS sprite: each grid tile
 * shows its slice of the same background image, so found tiles assemble into the
 * whole picture. Unfound tiles are covered. Fully offline (inline SVG data URI).
 */
export function PictureReveal({
  pictureId,
  foundTiles,
  maxSize = "min(78cqmin, 78cqh)",
}: {
  pictureId: string;
  foundTiles: Set<number>;
  maxSize?: string;
}) {
  const pic = getPicture(pictureId);
  const dataUri = `url("data:image/svg+xml,${encodeURIComponent(pic.svg.trim())}")`;

  return (
    <div
      className="grid overflow-hidden"
      style={{
        width: maxSize,
        aspectRatio: `${pic.cols} / ${pic.rows}`,
        gridTemplateColumns: `repeat(${pic.cols}, 1fr)`,
        gridTemplateRows: `repeat(${pic.rows}, 1fr)`,
        gap: "0.6cqmin",
        borderRadius: "2cqmin",
        padding: "0.6cqmin",
        background: tokens.faceGlassBottom,
        border: `0.5cqmin solid ${tokens.panelBorder}`,
      }}
    >
      {Array.from({ length: pic.rows * pic.cols }, (_, i) => {
        const r = Math.floor(i / pic.cols);
        const c = i % pic.cols;
        const xPct = pic.cols > 1 ? (c / (pic.cols - 1)) * 100 : 0;
        const yPct = pic.rows > 1 ? (r / (pic.rows - 1)) * 100 : 0;
        const found = foundTiles.has(i);
        return (
          <div
            key={i}
            className={found ? "reveal-pop" : ""}
            style={{
              borderRadius: "1cqmin",
              backgroundImage: found ? dataUri : "none",
              backgroundColor: found ? "transparent" : tokens.trayEmpty,
              backgroundSize: `${pic.cols * 100}% ${pic.rows * 100}%`,
              backgroundPosition: `${xPct}% ${yPct}%`,
              backgroundRepeat: "no-repeat",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: tokens.trayEmptyBorder,
              fontSize: "5cqmin",
            }}
          >
            {found ? "" : "?"}
          </div>
        );
      })}
    </div>
  );
}
