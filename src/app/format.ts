import type { Pharmacy } from "../data/schema";
import type { Messages } from "../i18n/messages";

/** The pharmacy's name from the data, or the localized fallback for unnamed features. */
export function displayName(pharmacy: Pharmacy, messages: Messages): string {
  return pharmacy.name?.trim() || messages.unnamedPharmacy;
}

/**
 * Address lines from the OSM address fields: "Street 3" and "00100 Helsinki". Returns an empty list
 * when there is nothing to show, so the caller can say "Address unavailable".
 */
export function addressLines(pharmacy: Pharmacy): string[] {
  const { street, housenumber, postcode, city } = pharmacy.address ?? {};
  const first = [street, street ? housenumber : undefined].filter(Boolean).join(" ");
  const second = [postcode, city].filter(Boolean).join(" ");
  return [first, second].filter((line) => line !== "");
}
