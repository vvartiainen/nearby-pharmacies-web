import { useEffect, useRef } from "react";
import type { DistanceBand } from "../i18n/distance";

export interface ResultRowProps {
  readonly id: string;
  readonly name: string;
  readonly distance: string;
  readonly distanceBand: DistanceBand;
  readonly selected: boolean;
  /** Scroll the row into view, and focus it when `focus` is set, after it mounts selected. */
  readonly reveal: boolean;
  readonly focus: boolean;
  readonly onSelect: (id: string) => void;
}

/** One result: a single button named "{name}, {distance}" that exposes its selected state. */
export function ResultRow({
  id,
  name,
  distance,
  distanceBand,
  selected,
  reveal,
  focus,
  onSelect,
}: ResultRowProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!reveal) return;
    ref.current?.scrollIntoView({ block: "nearest" });
    if (focus) ref.current?.focus({ preventScroll: true });
  }, [reveal, focus]);

  return (
    <li>
      <button
        ref={ref}
        type="button"
        className="result-row"
        aria-label={`${name}, ${distance}`}
        aria-pressed={selected}
        data-pharmacy-id={id}
        onClick={() => onSelect(id)}
      >
        <span className="result-row__name">{name}</span>
        <span className="result-row__distance" data-distance-band={distanceBand}>
          {distance}
        </span>
      </button>
    </li>
  );
}
