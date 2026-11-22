// All amenity=pharmacy features in Finland, with tags and a representative point.
// `out center tags` gives ways/relations the centre of their bounding box.
[out:json][timeout:180];
area["ISO3166-1"="FI"][admin_level=2]->.fi;
nwr["amenity"="pharmacy"](area.fi);
out center tags;
