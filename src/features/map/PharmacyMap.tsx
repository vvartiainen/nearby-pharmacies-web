import {
  circleMarker,
  control,
  divIcon,
  latLngBounds,
  layerGroup,
  map as createMap,
  marker as createMarker,
  polyline,
  tileLayer,
  type ControlPosition,
  type LatLngBounds,
  type LatLngExpression,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type Marker,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import type { LatLon } from "../../shared/geo/haversine";
import { attributionHtml, tileSettings } from "./config";

export interface MapPin {
  readonly id: string;
  readonly label: string;
  readonly position: LatLon;
}

export interface ObscuredEdges {
  readonly left: number;
  readonly bottom: number;
}

export interface PharmacyMapProps {
  readonly label: string;
  readonly origin: LatLon;
  readonly originLabel: string;
  readonly pins: readonly MapPin[];
  readonly selectedId: string | null;
  readonly selectionCount: number;
  readonly attribution: string;
  readonly attributionPosition: ControlPosition;
  readonly zoomPosition: ControlPosition;
  /** CSS pixels of the map covered at its edges: the narrow sheet below, the desktop card left. */
  readonly obscured: () => ObscuredEdges;
  readonly onSelect: (id: string) => void;
  readonly onPlaceOrigin: (point: LatLon) => void;
  readonly chooseOnMap: string;
  readonly searchFromHere: string;
  readonly cancel: string;
  readonly keepViewport: boolean;
  readonly resultsPanelRef: RefObject<HTMLElement | null>;
}

const fitMaxZoom = 17;
const edgePadding = 32;
// Pins hang above their anchor point; a selected pin is 1.5 × 36 px tall and 1.5 × 28 px wide.
const pinOverhangTop = 54;
const pinHalfWidth = 21;

/** Leave room around the markers without using up the visible map on a short screen. */
function viewPadding({ left, bottom }: ObscuredEdges, { x, y }: { x: number; y: number }) {
  const horizontalMargin = Math.max(0, Math.min(edgePadding, (x - left - pinHalfWidth * 2) / 4));
  const verticalMargin = Math.max(0, Math.min(edgePadding, (y - bottom - pinOverhangTop - 16) / 4));
  return {
    paddingTopLeft: [left + horizontalMargin + pinHalfWidth, verticalMargin + pinOverhangTop] as [
      number,
      number,
    ],
    paddingBottomRight: [horizontalMargin + pinHalfWidth, bottom + verticalMargin + 16] as [
      number,
      number,
    ],
  };
}

const pinPath = "M14 35C14 35 2 21.5 2 13.5a12 12 0 0 1 24 0C26 21.5 14 35 14 35Z";

// Anchor the 44 px hit box at the visible pin tip.
const pinIcon = divIcon({
  className: "pharmacy-pin",
  html:
    '<svg class="pharmacy-pin__shape" viewBox="0 0 28 36" width="28" height="36" aria-hidden="true">' +
    `<path class="pharmacy-pin__halo" d="${pinPath}"/><path class="pharmacy-pin__body" d="${pinPath}"/>` +
    '<path class="pharmacy-pin__cross" d="M12 7.5h4v4h4v4h-4v4h-4v-4H8v-4h4z"/></svg>',
  iconSize: [44, 44],
  iconAnchor: [22, 44],
});

const originIcon = divIcon({
  className: "origin-marker",
  html: '<span class="origin-marker__halo"></span><span class="origin-marker__dot"></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const toLatLng = ({ lat, lon }: LatLon): LatLngExpression => [lat, lon];

export function PharmacyMap(props: PharmacyMapProps) {
  const { label, origin, originLabel, pins, selectedId, selectionCount } = props;
  const containerRef = useRef<HTMLElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const automaticMove = useRef(false);
  const [mapPick, setMapPick] = useState<{
    point: LatLon;
    fixed: boolean;
    origin: LatLon;
    selectionCount: number;
  } | null>(null);
  // Tie the candidate to the current origin and selection so a change ends the pick.
  const candidate =
    mapPick?.origin === origin && mapPick.selectionCount === selectionCount ? mapPick.point : null;
  const select = useEffectEvent((id: string) => props.onSelect(id));
  const keepViewport = useEffectEvent(() => props.keepViewport);
  const chooseCandidate = useEffectEvent((point: { lat: number; lng: number }, fixed = false) => {
    setMapPick({ point: { lat: point.lat, lon: point.lng }, fixed, origin, selectionCount });
  });
  const candidateAtCentre = useEffectEvent((map: LeafletMap, start = false) => {
    if (automaticMove.current || (!start && !candidate)) return;
    const size = map.getSize();
    const { left, bottom } = props.obscured();
    chooseCandidate(
      map.containerPointToLatLng([(size.x + left) / 2, (size.y - bottom) / 2]).wrap(),
    );
  });
  const cancelPick = useEffectEvent((event: KeyboardEvent) => {
    if (candidate && event.key === "Escape") setMapPick(null);
  });
  const revealPoint = useEffectEvent((map: LeafletMap, position: LatLon) => {
    const size = map.getSize();
    const { left, bottom } = props.obscured();
    const point = map.latLngToContainerPoint(toLatLng(position));
    const margin = 40;
    if (
      point.x >= left + margin &&
      point.x <= size.x - margin &&
      point.y >= margin &&
      point.y <= size.y - bottom - margin
    )
      return;
    automaticMove.current = true;
    try {
      map.panBy([point.x - (size.x + left) / 2, point.y - (size.y - bottom) / 2], {
        animate: false,
      });
    } finally {
      automaticMove.current = false;
    }
  });
  const fitView = useEffectEvent((map: LeafletMap, bounds: LatLngBounds) => {
    automaticMove.current = true;
    try {
      map.invalidateSize({ animate: false, pan: false });
      map.fitBounds(bounds, {
        ...viewPadding(props.obscured(), map.getSize()),
        maxZoom: fitMaxZoom,
        animate: false,
      });
    } finally {
      automaticMove.current = false;
    }
  });

  const adjustPicker = useEffectEvent(() => {
    const map = mapRef.current;
    if (!map || !candidate) return;
    if (mapPick?.fixed) revealPoint(map, candidate);
    else candidateAtCentre(map);
  });

  const { resultsPanelRef } = props;
  useEffect(() => {
    const container = containerRef.current!;
    const map = createMap(container, {
      attributionControl: false,
      // Added below at a layout-dependent corner, clear of the desktop details card.
      zoomControl: false,
      maxZoom: tileSettings.maxZoom,
      center: [60.1721, 24.9412],
      zoom: 15,
    });
    tileLayer(tileSettings.url, { maxZoom: tileSettings.maxZoom }).addTo(map);
    mapRef.current = map;
    map.on("moveend", () => candidateAtCentre(map));
    container.addEventListener("keydown", cancelPick);
    map.on("contextmenu", (event: LeafletMouseEvent) => {
      chooseCandidate(event.latlng.wrap(), true);
    });
    const resize = new ResizeObserver(() => {
      automaticMove.current = true;
      try {
        map.invalidateSize({ animate: false });
      } finally {
        automaticMove.current = false;
      }
      adjustPicker();
    });
    resize.observe(container);
    if (resultsPanelRef.current) resize.observe(resultsPanelRef.current);
    return () => {
      resize.disconnect();
      container.removeEventListener("keydown", cancelPick);
      map.remove();
      mapRef.current = null;
    };
  }, [resultsPanelRef]);

  const { zoomPosition } = props;
  useEffect(() => {
    const zoomControl = control.zoom({ position: zoomPosition }).addTo(mapRef.current!);
    return () => {
      zoomControl.remove();
    };
  }, [zoomPosition]);

  const { attribution, attributionPosition } = props;
  useEffect(() => {
    const map = mapRef.current!;
    const attributionControl = control
      .attribution({ position: attributionPosition, prefix: false })
      .addAttribution(attributionHtml(attribution, tileSettings.attributionUrl))
      .addTo(map);
    return () => {
      attributionControl.remove();
    };
  }, [attribution, attributionPosition]);

  useEffect(() => {
    const map = mapRef.current!;
    const markers = markersRef.current;
    const originMarker = createMarker(toLatLng(origin), {
      icon: originIcon,
      interactive: false,
      keyboard: false,
      // Above the unselected pharmacy pins.
      zIndexOffset: 2000,
    }).addTo(map);
    const originElement = originMarker.getElement();
    originElement?.setAttribute("role", "img");
    originElement?.setAttribute("aria-label", originLabel);

    for (const pin of pins) {
      const pinMarker = createMarker(toLatLng(pin.position), { icon: pinIcon, keyboard: true })
        .on("click", () => select(pin.id))
        .addTo(map);
      const element = pinMarker.getElement()!;
      element.setAttribute("aria-label", pin.label);
      element.setAttribute("aria-pressed", "false");
      element.dataset.pharmacyId = pin.id;
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select(pin.id);
      });
      markers.set(pin.id, pinMarker);
    }

    if (!keepViewport()) {
      const bounds = latLngBounds([toLatLng(origin), ...pins.map((pin) => toLatLng(pin.position))]);
      fitView(map, bounds);
    } else {
      revealPoint(map, origin);
    }

    return () => {
      originMarker.remove();
      for (const pinMarker of markers.values()) pinMarker.remove();
      markers.clear();
    };
  }, [origin, originLabel, pins]);

  // Runs after the markers are rebuilt for new pins, and on every selection, including a repeat.
  useEffect(() => {
    for (const pin of pins) {
      const pinMarker = markersRef.current.get(pin.id);
      const selected = pin.id === selectedId;
      const element = pinMarker?.getElement();
      element?.classList.toggle("is-selected", selected);
      element?.setAttribute("aria-pressed", String(selected));
      pinMarker?.setZIndexOffset(selected ? 3000 : 0);
    }
    const map = mapRef.current;
    const selected = selectedId === null ? undefined : markersRef.current.get(selectedId);
    if (!map || !selected || selectionCount === 0) return;

    const endpoints = [toLatLng(origin), selected.getLatLng()];
    const lineStyle = { dashArray: "7 6", interactive: false };
    const line = layerGroup([
      polyline(endpoints, {
        ...lineStyle,
        className: "selection-line-outline",
        color: "#ffffff",
        weight: 6,
      }),
      polyline(endpoints, {
        ...lineStyle,
        className: "selection-line",
        color: "#243e9e",
        weight: 3,
      }),
    ]).addTo(map);
    fitView(map, latLngBounds(endpoints));

    return () => {
      line.remove();
    };
  }, [origin, pins, selectedId, selectionCount]);

  useEffect(() => {
    if (!candidate) return;
    const marker = circleMarker(toLatLng(candidate), {
      className: "map-picker__target",
      radius: 8,
      weight: 3,
      interactive: false,
    }).addTo(mapRef.current!);
    return () => {
      marker.remove();
    };
  }, [candidate]);

  const focusMap = () => containerRef.current?.focus({ preventScroll: true });

  return (
    <>
      <section
        ref={containerRef}
        className="map"
        data-testid="map"
        data-has-selection={selectedId !== null ? "" : undefined}
        aria-label={label}
      />
      <div className="map-picker" data-picking={candidate ? "" : undefined}>
        <button
          type="button"
          className="map-picker__main"
          onClick={() => {
            if (candidate) {
              props.onPlaceOrigin(candidate);
            } else {
              candidateAtCentre(mapRef.current!, true);
            }
            // Arrow keys then move the map under the target.
            focusMap();
          }}
        >
          {candidate ? props.searchFromHere : props.chooseOnMap}
        </button>
        {candidate && (
          <button
            type="button"
            className="map-picker__cancel"
            aria-label={props.cancel}
            title={props.cancel}
            onClick={() => {
              setMapPick(null);
              focusMap();
            }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
