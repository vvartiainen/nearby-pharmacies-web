import { useEffect, useEffectEvent, type ReactNode, type RefObject } from "react";
import type { Messages } from "../../shared/i18n/messages";

export interface DetailsCardProps {
  readonly ref: RefObject<HTMLElement | null>;
  readonly messages: Messages;
  readonly onClose: () => void;
  /** Changes with each selection; the body remounts, so new details start scrolled to the top. */
  readonly selectionKey: number;
  readonly children: ReactNode;
}

/**
 * Desktop details over the map's top-left corner: a labelled region, not a dialog, so there is no
 * focus trap or backdrop. The close button, or Escape while focus is inside, closes it.
 */
export function DetailsCard({ ref, messages, onClose, selectionKey, children }: DetailsCardProps) {
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    card.addEventListener("keydown", onKeyDown);
    return () => card.removeEventListener("keydown", onKeyDown);
  }, [ref]);

  return (
    <section
      ref={ref}
      className="details-card"
      data-testid="details-card"
      aria-label={messages.detailsLabel}
    >
      <button
        type="button"
        className="details-card__close"
        aria-label={messages.closeDetails}
        onClick={onClose}
      >
        <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
          <path d="m3.5 3.5 9 9m0-9-9 9" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <div key={selectionKey} className="details-card__body">
        {children}
      </div>
    </section>
  );
}
