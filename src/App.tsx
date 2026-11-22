import { formatStraightLine } from "./i18n/distance";
import type { SupportedLocale } from "./i18n/locale";
import { messagesFor } from "./i18n/messages";

/** Illustrative distance from the design spec's "Distance format" examples. */
const sampleMeters = 1700;

export function App({ locale }: { locale: SupportedLocale }) {
  const messages = messagesFor(locale);
  return (
    <main>
      <h1>{messages.heading}</h1>
      <figure>
        <figcaption>{messages.sampleCaption}</figcaption>
        <p data-testid="sample-distance">{formatStraightLine(sampleMeters, locale)}</p>
      </figure>
    </main>
  );
}
