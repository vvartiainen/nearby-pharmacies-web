import { interpretOpeningHours, type InterpretedHours } from "./openingHours";
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
  const hours = openingHours?.trim() ? interpretOpeningHours(openingHours) : undefined;
  const weekly = hours?.kind === "weekly";
  return (
    <section className="hours" data-testid="hours">
      <h3 className="hours__heading">
        {weekly ? messages.weeklyHoursHeading : messages.hoursHeading}
      </h3>
      {weekly && <p className="hours__holiday-note">{messages.holidayHoursNote}</p>}
      {hoursContent(hours, messages, locale)}
    </section>
  );
}

function hoursContent(
  hours: InterpretedHours | undefined,
  messages: Messages,
  locale: SupportedLocale,
) {
  if (!hours) return <p className="notice">{messages.hoursUnavailable}</p>;
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
