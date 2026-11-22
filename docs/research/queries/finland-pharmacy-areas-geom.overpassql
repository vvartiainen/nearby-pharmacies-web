// Full geometry of pharmacy ways and relations in Finland, to compare the
// bounding-box centre with a polygon centroid.
[out:json][timeout:180];
area["ISO3166-1"="FI"][admin_level=2]->.fi;
(
  way["amenity"="pharmacy"](area.fi);
  relation["amenity"="pharmacy"](area.fi);
);
out geom tags;
