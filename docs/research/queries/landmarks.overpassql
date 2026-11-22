// Public landmark origins for the three sample areas.
[out:json][timeout:60];
(
  nwr["railway"="station"]["name"="Helsinki"](60.15,24.90,60.20,24.97);
  nwr["building"="train_station"]["name"~"Helsing"](60.15,24.90,60.20,24.97);
  nwr["place"]["name"="Utsjoki"](69.80,26.80,69.95,27.10);
  nwr["place"]["name"="Tornio"](65.80,24.10,65.90,24.20);
  nwr["railway"="station"]["name"~"Tornio|Haparanda"](65.78,24.05,65.90,24.25);
  nwr["place"]["name"="Haparanda"](65.80,24.05,65.88,24.18);
);
out center tags;
