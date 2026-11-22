import { interpretOpeningHours } from "./openingHours";
import type { SupportedLocale } from "../../shared/i18n/locale";
import type { Messages } from "../../shared/i18n/messages";
import { formatTimeRange } from "./time";

export function HoursBlock({
  openingHours,
  messages,
  locale,
}: {
  openingHours: string | undefined;
  messages: Messages;
  locale: SupportedLocale;
}) {
  return (
    <section className="hours" data-testid="hours">
      <h3 className="hours__heading">{messages.hoursHeading}</h3>
      {hoursContent(openingHours, messages, locale)}
    </section>
  );
}

function hoursContent(
  openingHours: string | undefined,
  messages: Messages,
  locale: SupportedLocale,
) {
  if (!openingHours?.trim()) return <p className="notice">{messages.hoursUnavailable}</p>;
  const hours = interpretOpeningHours(openingHours);
  if (hours.kind === "raw") return <p className="hours__raw">{hours.text}</p>;

  const dayNames = messages.days.split(" ");
  return (
    <dl className="hours__days">
      {hours.days.map((ranges, index) => (
        <div className="hours__day" key={dayNames[index]}>
          <dt>{dayNames[index]}</dt>
          <dd>
            {ranges.length === 0
              ? messages.closed
              : ranges.map((range) => formatTimeRange(range, locale)).join(", ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
