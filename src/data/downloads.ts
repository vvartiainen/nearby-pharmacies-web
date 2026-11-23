import coverage from "./coverage.fi.json?url&no-inline";
import manifest from "./manifest.fi.json?url&no-inline";
import notice from "./ODbL-NOTICE.txt?url&no-inline";
import pharmacies from "./pharmacies.fi.json?url&no-inline";
import places from "./places.fi.json?url&no-inline";

const downloads = {
  "pharmacies.fi.json": pharmacies,
  "places.fi.json": places,
  "coverage.fi.json": coverage,
  "manifest.fi.json": manifest,
  "ODbL-NOTICE.txt": notice,
};

const list = document.querySelector("#data-files")!;
for (const [name, url] of Object.entries(downloads)) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.textContent = name;
  const item = document.createElement("li");
  item.append(link);
  list.append(item);
}

if (import.meta.env.PROD) {
  document.querySelector("#software-licences")!.removeAttribute("hidden");
}
