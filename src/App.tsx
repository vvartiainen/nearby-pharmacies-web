import { formatKilometres } from "./i18n/distance";
import type { SupportedLocale } from "./i18n/locale";
import { interpolate, messagesFor } from "./i18n/messages";

const sampleKilometres = 0.4;

export function App({ locale }: { locale: SupportedLocale }) {
  const messages = messagesFor(locale);
  return (
    <main>
      <h1>{messages.heading}</h1>
      <figure>
        <figcaption>{messages.sampleCaption}</figcaption>
        <p data-testid="sample-distance">
          {interpolate(messages.straightLine, {
            distance: formatKilometres(sampleKilometres, locale),
          })}
        </p>
      </figure>
    </main>
  );
}
