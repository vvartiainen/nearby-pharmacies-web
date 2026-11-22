import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { browserPreferences, resolveLocale } from "./shared/i18n/locale";
import { messagesFor } from "./shared/i18n/messages";
import "./shared/base.css";
import "./app/layout.css";
import "./features/origin/origin.css";
import "./features/pharmacies/pharmacies.css";
import "./features/map/map.css";

const locale = resolveLocale(browserPreferences(navigator));
document.documentElement.lang = locale;
document.title = messagesFor(locale).title;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App locale={locale} />
  </StrictMode>,
);
