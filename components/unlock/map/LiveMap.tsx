"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

/** Carto dark tiles. Do not use Leaflet `{r}` retina tokens — MapLibre leaves them literal and tiles 404. */
const CARTO_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "unlock-void": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO"
    }
  },
  layers: [
    {
      id: "unlock-void-base",
      type: "raster",
      source: "unlock-void",
      paint: {
        "raster-brightness-max": 0.7,
        "raster-contrast": 0.12,
        "raster-saturation": -0.2
      }
    }
  ]
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

/**
 * Real map surface for UNLOCK World discovery.
 * Carto dark / OSM raster tiles — no API key required.
 */
export function LiveMap({
  pins,
  fallbackCenter = JOBURG
}: {
  pins: MapPin[];
  fallbackCenter?: { lat: number; lng: number };
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const validPins = pins.filter(isValidPin);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      validPins.length > 0
        ? [validPins[0].lng, validPins[0].lat]
        : [fallbackCenter.lng, fallbackCenter.lat];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: CARTO_DARK_STYLE,
        center,
        zoom: CITY_ZOOM,
        attributionControl: false,
        failIfMajorPerformanceCaveat: false
      });
    } catch {
      setFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* container may be unmounting */
      }
    };

    map.on("load", () => {
      resize();
      validPins.forEach((pin) => {
        const wrap = document.createElement("div");
        wrap.className = "unlock-map-pin-wrap";
        wrap.style.cssText =
          "display:flex;align-items:center;gap:6px;cursor:pointer;max-width:180px;";
        wrap.title = pin.label || pin.campaign_title;
        wrap.setAttribute("role", "link");
        wrap.tabIndex = 0;

        const el = document.createElement("span");
        el.className = "unlock-map-pin";
        el.style.cssText =
          "flex-shrink:0;width:14px;height:14px;border-radius:9999px;background:#C6FF3D;border:2px solid #0B0A14;box-shadow:0 0 12px rgba(198,255,61,0.7);";

        const caption = document.createElement("span");
        caption.textContent = pin.label || pin.campaign_title;
        caption.style.cssText =
          "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:#ECE9F7;background:rgba(11,10,20,0.9);border:1px solid rgba(255,255,255,0.12);padding:3px 7px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

        wrap.append(el, caption);

        const go = () => router.push(`/campaign/${pin.campaign_id}`);
        wrap.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          go();
        });
        wrap.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            go();
          }
        });

        new maplibregl.Marker({ element: wrap, anchor: "left" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
      });

      if (validPins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        validPins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
      } else if (validPins.length === 1) {
        map.setCenter([validPins[0].lng, validPins[0].lat]);
        map.setZoom(13);
      }
    });

    map.on("error", () => {
      /* tile 404s should not unmount the map */
    });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    requestAnimationFrame(resize);

    mapRef.current = map;
    return () => {
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [validPins, fallbackCenter.lat, fallbackCenter.lng, router]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink2 min-h-[280px]">
        <p className="font-mono text-xs text-mute tracking-widest uppercase px-4 text-center">
          Map failed to load — experiences are still listed below
        </p>
      </div>
    );
  }

  return (
    <div className="unlock-live-map relative w-full h-full min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0 min-h-[280px]" />
      {validPins.length === 0 && (
        <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none z-10">
          <p className="font-mono text-[10px] text-mute tracking-widest uppercase bg-void/80 border border-white/10 px-3 py-2">
            Johannesburg · no field pins yet — experiences still listed below
          </p>
        </div>
      )}
    </div>
  );
}
