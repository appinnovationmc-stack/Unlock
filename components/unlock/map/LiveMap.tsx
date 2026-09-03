"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";
import { PinSnippet } from "./PinSnippet";

export type MapPin = {
  location_id: string;
  campaign_id: string;
  campaign_title: string;
  label: string;
  lat: number;
  lng: number;
  radius_m: number;
  logo_url?: string | null;
  brand_name?: string | null;
};

const JOBURG = { lat: -26.2041, lng: 28.0473 };
const CITY_ZOOM = 11;

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

function safeHttp(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return url;
  } catch {
    /* */
  }
  return null;
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

function attachPins(
  map: maplibregl.Map,
  pins: MapPin[],
  reduced: boolean,
  onPick: (pin: MapPin) => void
) {
  pins.forEach((pin) => {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "unlock-map-pin-wrap";
    const name = pin.brand_name || pin.campaign_title;
    wrap.setAttribute("aria-label", name);
    wrap.style.cssText =
      "display:flex;align-items:center;justify-content:center;cursor:pointer;border:0;padding:0;background:transparent;width:44px;height:44px;";
    wrap.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPick(pin);
    });

    const logo = safeHttp(pin.logo_url);
    if (logo) {
      const img = document.createElement("img");
      img.src = logo;
      img.alt = "";
      img.width = 36;
      img.height = 36;
      img.className = "unlock-map-pin";
      img.style.cssText =
        "width:36px;height:36px;border-radius:9999px;object-fit:cover;background:#fff;box-shadow:0 1px 6px rgba(29,29,31,0.2);";
      img.addEventListener("error", () => {
        img.remove();
        wrap.append(monogram(name));
      });
      wrap.append(img);
    } else {
      wrap.append(monogram(name));
    }

    new maplibregl.Marker({ element: wrap, anchor: "center" })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
  });

  if (pins.length > 1) {
    const bounds = new maplibregl.LngLatBounds();
    pins.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: reduced ? 0 : 0 });
  } else if (pins.length === 1) {
    map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 13 });
  }
}

function monogram(name: string) {
  const el = document.createElement("span");
  el.className = "unlock-map-pin";
  el.textContent = (name.slice(0, 1) || "·").toUpperCase();
  el.style.cssText =
    "width:36px;height:36px;border-radius:9999px;background:#1d1d1f;color:#fff;font:600 14px Unbounded,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(29,29,31,0.2);";
  return el;
}

export function LiveMap({
  pins,
  fallbackCenter = JOBURG
}: {
  pins: MapPin[];
  fallbackCenter?: { lat: number; lng: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickRef = useRef<(pin: MapPin) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<MapPin | null>(null);
  pickRef.current = setPicked;

  const validPins = useMemo(() => pins.filter(isValidPin), [pins]);
  const pinKey = useMemo(
    () =>
      validPins
        .map((p) => `${p.location_id}:${p.lat}:${p.lng}:${p.campaign_id}:${p.logo_url ?? ""}`)
        .join("|"),
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
        /* */
      }
    };

    let pinsAttached = false;
    const placePins = () => {
      if (pinsAttached) return;
      pinsAttached = true;
      resize();
      attachPins(map, currentPins, reduced, (pin) => pickRef.current(pin));
      labelMapControls(map);
    };

    map.on("error", () => {});
    map.once("load", placePins);
    map.once("style.load", () => {
      if (reduced) placePins();
      else requestAnimationFrame(placePins);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, fallbackCenter.lat, fallbackCenter.lng]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink2 min-h-[280px]">
        <p className="text-sm text-mute px-4 text-center">Map failed to load</p>
      </div>
    );
  }

  return (
    <div className="unlock-live-map relative w-full h-full min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0 min-h-[280px]" />
      {validPins.length === 0 && (
        <div className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none z-10">
          <p className="text-sm text-mute unlock-glass px-3 py-2">The field is quiet.</p>
        </div>
      )}
      {picked ? <PinSnippet pin={picked} onClose={() => setPicked(null)} /> : null}
    </div>
  );
}
