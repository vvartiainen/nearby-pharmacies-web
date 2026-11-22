import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { messagesFor } from "../../shared/i18n/messages";
import { HoursBlock } from "./HoursBlock";

it.each([
  { openingHours: undefined, expected: "Hours unavailable" },
  { openingHours: "  ", expected: "Hours unavailable" },
  { openingHours: "PH off", expected: "PH off" },
])("uses the general heading for fallback hours ($openingHours)", ({ openingHours, expected }) => {
  const html = renderToStaticMarkup(
    <HoursBlock openingHours={openingHours} messages={messagesFor("en")} locale="en" />,
  );

  expect(html).toContain(">Opening hours</h3>");
  expect(html).toContain(`>${expected}</p>`);
  expect(html).not.toContain("Holiday hours may differ.");
});
