// Pharmacies in northern Lapland and adjacent Norway within 160 km of Utsjoki,
// to show sparse coverage and the cross-border alternative.
[out:json][timeout:60];
nwr["amenity"="pharmacy"](around:160000,69.908,27.027);
out center tags;
