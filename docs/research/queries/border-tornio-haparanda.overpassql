// Pharmacies on both sides of the Tornio (FI) / Haparanda (SE) border,
// within 30 km of Tornio town centre, tagged with the country they fall in.
[out:json][timeout:60];
nwr["amenity"="pharmacy"](around:30000,65.848,24.145);
out center tags;
