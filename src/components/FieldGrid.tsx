"use client";

import { useStore } from "@/game/store";
import { gridColumns, gridRows } from "@/lib/grid";
import { RadioField } from "./RadioField";

export function FieldGrid() {
  const fieldCount = useStore((s) => s.config.fieldCount);
  const cols = gridColumns(fieldCount);
  const rows = gridRows(fieldCount);

  return (
    <div
      className="grid flex-1"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: "clamp(6px, 1vw, 20px)",
        padding: "clamp(6px, 1vw, 20px)",
        minHeight: 0,
      }}
    >
      {Array.from({ length: fieldCount }, (_, i) => (
        <RadioField key={i} index={i} />
      ))}
    </div>
  );
}
