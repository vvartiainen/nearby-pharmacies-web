import type { Pharmacy } from "../../data/schema";
import type { Messages } from "../../shared/i18n/messages";

export function displayName(pharmacy: Pharmacy, messages: Messages): string {
  return pharmacy.name?.trim() || messages.unnamedPharmacy;
}

export function addressLines(pharmacy: Pharmacy): string[] {
  const { street, housenumber, postcode, city } = pharmacy.address ?? {};
  const first = [street, street ? housenumber : undefined].filter(Boolean).join(" ");
  const second = [postcode, city].filter(Boolean).join(" ");
  return [first, second].filter((line) => line !== "");
}
