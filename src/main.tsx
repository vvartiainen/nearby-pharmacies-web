import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { browserPreferences, resolveLocale } from "./i18n/locale";
import { messagesFor } from "./i18n/messages";
import "./styles.css";

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
