"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Vector dark streets. Carto raster `dark_all` now watermarks anonymous use. No API key. */
const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";

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

    const center: [number, number] =
      currentPins.length > 0
        ? [currentPins[0].lng, currentPins[0].lat]
        : [fallbackCenter.lng, fallbackCenter.lat];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_DARK,
        center,
        zoom: CITY_ZOOM,
        attributionControl: false
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
      currentPins.forEach((pin) => {
        const wrap = document.createElement("a");
        wrap.href = `/campaign/${pin.campaign_id}`;
        wrap.className = "unlock-map-pin-wrap";
        wrap.style.cssText =
          "display:flex;align-items:center;gap:6px;cursor:pointer;max-width:180px;text-decoration:none;";
        wrap.title = pin.label || pin.campaign_title;

        const el = document.createElement("span");
        el.className = "unlock-map-pin";
        el.style.cssText =
          "flex-shrink:0;width:14px;height:14px;border-radius:9999px;background:#C6FF3D;border:2px solid #0B0A14;box-shadow:0 0 12px rgba(198,255,61,0.7);";

        const caption = document.createElement("span");
        caption.textContent = pin.label || pin.campaign_title;
        caption.style.cssText =
          "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:#ECE9F7;background:rgba(11,10,20,0.9);border:1px solid rgba(255,255,255,0.12);padding:3px 7px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

        wrap.append(el, caption);

        new maplibregl.Marker({ element: wrap, anchor: "left" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
      });

      if (currentPins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        currentPins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
      } else if (currentPins.length === 1) {
        map.setCenter([currentPins[0].lng, currentPins[0].lat]);
        map.setZoom(13);
      }
    });

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    requestAnimationFrame(resize);

    mapRef.current = map;
    return () => {
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
