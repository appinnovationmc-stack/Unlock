"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";
import { paperMapStyle } from "@/lib/unlock/map/paper-style";
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
const CITY_ZOOM = 12;

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

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
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

function youMarkerEl() {
  const wrap = document.createElement("div");
  wrap.className = "unlock-you";
  wrap.setAttribute("aria-label", "You");
  wrap.style.cssText =
    "width:44px;height:44px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
  const pulse = document.createElement("span");
  pulse.style.cssText =
    "position:absolute;width:44px;height:44px;border-radius:9999px;background:rgba(17,17,17,0.12);";
  const img = document.createElement("img");
  img.src = "/unlock-mark.svg";
  img.alt = "";
  img.width = 28;
  img.height = 28;
  img.style.cssText =
    "width:28px;height:28px;border-radius:9999px;position:relative;box-shadow:0 2px 8px rgba(17,17,17,0.25);";
  wrap.append(pulse, img);
  return wrap;
}

function attachPins(
  map: maplibregl.Map,
  pins: MapPin[],
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
        "width:36px;height:36px;border-radius:9999px;object-fit:cover;background:#fff;box-shadow:0 1px 6px rgba(29,29,31,0.2);border:2px solid #fff;";
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
}

function monogram(name: string) {
  const el = document.createElement("span");
  el.className = "unlock-map-pin";
  el.textContent = (name.slice(0, 1) || "·").toUpperCase();
  el.style.cssText =
    "width:36px;height:36px;border-radius:9999px;background:#111;color:#fff;font:600 14px Unbounded,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(29,29,31,0.2);border:2px solid #fff;";
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
  const youRef = useRef<maplibregl.Marker | null>(null);
  const watchRef = useRef<number | null>(null);
  const pickRef = useRef<(pin: MapPin) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<MapPin | null>(null);
  const [you, setYou] = useState<{ lat: number; lng: number } | null>(null);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  pickRef.current = setPicked;

  const validPins = useMemo(() => pins.filter(isValidPin), [pins]);
  const pinKey = useMemo(
    () =>
      validPins
        .map((p) => `${p.location_id}:${p.lat}:${p.lng}:${p.campaign_id}:${p.logo_url ?? ""}`)
        .join("|"),
    [validPins]
  );

  const pickedDistance =
    picked && you ? Math.round(haversineM(you, { lat: picked.lat, lng: picked.lng })) : null;

  function placeYou(lat: number, lng: number, fly: boolean) {
    const map = mapRef.current;
    if (!map) return;
    if (!youRef.current) {
      youRef.current = new maplibregl.Marker({ element: youMarkerEl(), anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      youRef.current.setLngLat([lng, lat]);
    }
    setYou({ lat, lng });
    if (fly) {
      const reduced = prefersReducedMotion();
      map.easeTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: reduced ? 0 : 600
      });
    }
  }

  function startWatch(flyOnce: boolean) {
    if (!navigator.geolocation) {
      setLocateMsg("This device cannot share a location.");
      return;
    }
    setLocateMsg(null);
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    let first = flyOnce;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        placeYou(pos.coords.latitude, pos.coords.longitude, first);
        first = false;
      },
      (err) => {
        setLocateMsg(err.code === 1 ? "Allow location to see yourself here." : "Could not find you yet.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 8000 }
    );
  }

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
        style: paperMapStyle(),
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
      attachPins(map, currentPins, (pin) => pickRef.current(pin));
      if (currentPins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        currentPins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
      } else if (currentPins.length === 1) {
        map.jumpTo({ center: [currentPins[0].lng, currentPins[0].lat], zoom: 13 });
      }
      labelMapControls(map);
      startWatch(false);
    };

    map.on("error", () => {});
    map.once("load", placePins);
    map.once("style.load", () => requestAnimationFrame(placePins));
    const fallback = window.setTimeout(placePins, 2500);

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    requestAnimationFrame(resize);

    mapRef.current = map;
    return () => {
      window.clearTimeout(fallback);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      youRef.current = null;
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
      <button
        type="button"
        className="unlock-glass absolute top-3 right-12 z-10 min-h-11 px-3 text-sm text-fog"
        onClick={() => startWatch(true)}
      >
        {you ? "I'm here" : "Find me"}
      </button>
      {locateMsg ? (
        <p className="absolute top-16 right-3 z-10 unlock-glass px-3 py-2 text-xs text-mute max-w-[200px]">
          {locateMsg}
        </p>
      ) : null}
      {validPins.length === 0 && (
        <div className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none z-10">
          <p className="text-sm text-mute unlock-glass px-3 py-2">Quiet right now.</p>
        </div>
      )}
      {picked ? (
        <PinSnippet
          pin={picked}
          distanceM={pickedDistance}
          onClose={() => setPicked(null)}
        />
      ) : null}
    </div>
  );
}
