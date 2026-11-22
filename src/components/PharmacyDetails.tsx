import { useEffect, useRef } from "react";
import type { SupportedLocale } from "../i18n/locale";
import type { Messages } from "../i18n/messages";
import { HoursBlock } from "./HoursBlock";

export interface PharmacyDetailsProps {
  readonly name: string;
  readonly distance: string;
  readonly address: readonly string[];
  readonly openingHours: string | undefined;
  readonly messages: Messages;
  readonly locale: SupportedLocale;
  /** Move focus to the name when the details open for the row the user just activated. */
  readonly focusOnMount: boolean;
}

export function PharmacyDetails(props: PharmacyDetailsProps) {
  const { name, distance, address, openingHours, messages, locale, focusOnMount } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <article className="details" data-testid="details">
      <div className="details__summary">
        <h2 ref={headingRef} className="details__name" tabIndex={-1}>
          {name}
        </h2>
        <p className="details__distance">{distance}</p>
        {address.length > 0 ? (
          <address className="details__address">
            {address.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
        ) : (
          <p className="details__address details__address--missing">
            {messages.addressUnavailable}
          </p>
        )}
      </div>
      <HoursBlock openingHours={openingHours} messages={messages} locale={locale} />
    </article>
  );
}
