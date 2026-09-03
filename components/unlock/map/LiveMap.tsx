"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";

export type MapPin = {
  location_id: string;
  campaign_id: string;
  campaign_title: string;
  label: string;
  lat: number;
  lng: number;
  radius_m: number;
};

const JOBURG = { lat: -26.2041, lng: 28.0473 };
const CITY_ZOOM = 11;

/** Esri World Street Map — public raster, no API key, no Carto watermark. Tile path is z/y/x. */
const STREET_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      attribution: "Tiles © Esri"
    }
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }]
};

function isValidPin(pin: MapPin): boolean {
  return (
    Number.isFinite(pin.lat) &&
    Number.isFinite(pin.lng) &&
    Math.abs(pin.lat) <= 90 &&
    Math.abs(pin.lng) <= 180 &&
    Boolean(pin.campaign_id)
  );
}

function labelMapControls(map: maplibregl.Map) {
  const root = map.getContainer();
  const labels: [string, string][] = [
    [".maplibregl-ctrl-zoom-in", "Zoom in"],
    [".maplibregl-ctrl-zoom-out", "Zoom out"],
    [".maplibregl-ctrl-compass", "Reset bearing"],
    [".maplibregl-ctrl-attrib-button", "Map attribution"]
  ];
  for (const [sel, label] of labels) {
    const el = root.querySelector(sel);
    if (el instanceof HTMLElement) {
      el.setAttribute("aria-label", label);
      el.setAttribute("title", label);
    }
  }
}

function attachPins(map: maplibregl.Map, pins: MapPin[], reduced: boolean) {
  pins.forEach((pin) => {
    const wrap = document.createElement("a");
    wrap.href = `/campaign/${pin.campaign_id}`;
    wrap.className = "unlock-map-pin-wrap";
    wrap.setAttribute("aria-label", pin.label || pin.campaign_title);
    wrap.style.cssText =
      "display:flex;align-items:center;gap:6px;cursor:pointer;max-width:180px;text-decoration:none;";
    wrap.title = pin.label || pin.campaign_title;

    const el = document.createElement("span");
    el.className = "unlock-map-pin";
    el.style.cssText =
      "flex-shrink:0;width:12px;height:12px;border-radius:9999px;background:#C6FF3D;border:2px solid #0B0A14;";

    const caption = document.createElement("span");
    caption.textContent = pin.label || pin.campaign_title;
    caption.style.cssText =
      "font-family:Inter,system-ui,sans-serif;font-size:12px;color:#ECE9F7;background:rgba(11,10,20,0.88);padding:4px 8px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

    wrap.append(el, caption);

    new maplibregl.Marker({ element: wrap, anchor: "left" })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
  });

  if (pins.length > 1) {
    const bounds = new maplibregl.LngLatBounds();
    pins.forEach((p) => bounds.extend([p.lng, p.lat]));
    // Never flyTo — jump/fit with duration 0 when reduced motion is on.
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: reduced ? 0 : 0 });
  } else if (pins.length === 1) {
    map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 13 });
  }
}

/**
 * Real map surface for UNLOCK World discovery.
 */
export function LiveMap({
  pins,
  fallbackCenter = JOBURG
}: {
  pins: MapPin[];
  fallbackCenter?: { lat: number; lng: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const validPins = useMemo(() => pins.filter(isValidPin), [pins]);
  const pinKey = useMemo(
    () => validPins.map((p) => `${p.location_id}:${p.lat}:${p.lng}:${p.campaign_id}`).join("|"),
    [validPins]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const currentPins = pins.filter(isValidPin);
    const reduced = prefersReducedMotion();

    const center: [number, number] =
      currentPins.length > 0
        ? [currentPins[0].lng, currentPins[0].lat]
        : [fallbackCenter.lng, fallbackCenter.lat];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STREET_STYLE,
        center,
        zoom: CITY_ZOOM,
        attributionControl: false,
        fadeDuration: reduced ? 0 : 300
      });
    } catch {
      setFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    labelMapControls(map);

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* container may be unmounting */
      }
    };

    let pinsAttached = false;
    const placePins = () => {
      if (pinsAttached) return;
      pinsAttached = true;
      resize();
      attachPins(map, currentPins, reduced);
      labelMapControls(map);
    };

    map.on("error", () => {
      /* raster 404s shouldn't blank the map; constructor already succeeded */
    });
    map.once("load", placePins);
    map.once("style.load", () => {
      if (reduced) {
        placePins();
        return;
      }
      requestAnimationFrame(placePins);
    });
    const fallback = window.setTimeout(placePins, 2500);

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    if (reduced) resize();
    else requestAnimationFrame(resize);

    mapRef.current = map;
    return () => {
      window.clearTimeout(fallback);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // pinKey captures coordinate/id changes without a new array identity each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, fallbackCenter.lat, fallbackCenter.lng]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink2 min-h-[280px]">
        <p className="text-sm text-mute px-4 text-center">
          Map failed to load — experiences are still listed below
        </p>
      </div>
    );
  }

  return (
    <div className="unlock-live-map relative w-full h-full min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0 min-h-[280px]" />
      {validPins.length === 0 && (
        <div className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none z-10">
          <p className="text-sm text-mute bg-void/80 px-3 py-2">
            No field pins yet — experiences still listed below
          </p>
        </div>
      )}
    </div>
  );
}
