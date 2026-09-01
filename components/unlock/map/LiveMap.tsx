"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
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

/**
 * Real map surface for UNLOCK World discovery.
 * OSM raster tiles — no API key required.
 */
export function LiveMap({
  pins,
  fallbackCenter = { lat: -26.2041, lng: 28.0473 }
}: {
  pins: MapPin[];
  fallbackCenter?: { lat: number; lng: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      pins.length > 0
        ? [pins[0].lng, pins[0].lat]
        : [fallbackCenter.lng, fallbackCenter.lat];

    const map = new maplibregl.Map({
      container: containerRef.current,
      // UNLOCK "void" map style — Carto dark-matter basemap (no API key required),
      // recolored via raster-* paint props to sit inside the void/volt palette
      // instead of shipping a generic light/OSM look.
      style: {
        version: 8,
        sources: {
          "unlock-void": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
              "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
              "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap © CARTO"
          },
          "unlock-labels": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
              "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
              "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            ],
            tileSize: 256
          }
        },
        layers: [
          {
            id: "unlock-void-base",
            type: "raster",
            source: "unlock-void",
            paint: {
              // Push the base map further into "void" — darker, slightly
              // desaturated, so it recedes and pins/UI stay the focus.
              "raster-brightness-max": 0.55,
              "raster-contrast": 0.15,
              "raster-saturation": -0.3
            }
          },
          {
            id: "unlock-void-labels",
            type: "raster",
            source: "unlock-labels",
            paint: {
              "raster-opacity": 0.75
            }
          }
        ]
      },
      center,
      zoom: pins.length ? 12 : 5,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      pins.forEach((pin) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "unlock-map-pin";
        el.style.cssText =
          "width:14px;height:14px;border-radius:9999px;background:#C6FF3D;border:2px solid #0B0A14;box-shadow:0 0 12px rgba(198,255,61,0.7);cursor:pointer;padding:0;";
        el.title = pin.label;

        const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
          `<div style="font-family:ui-monospace,monospace;font-size:11px;padding:4px 2px;">
            <div style="color:#C6FF3D;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;">${escapeHtml(pin.label)}</div>
            <div style="color:#e8e6f0;margin-bottom:6px;">${escapeHtml(pin.campaign_title)}</div>
            <a href="/campaign/${pin.campaign_id}" style="color:#C6FF3D;text-decoration:underline;">Open experience →</a>
          </div>`
        );

        new maplibregl.Marker({ element: el })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(popup)
          .addTo(map);
      });

      if (pins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        pins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins, fallbackCenter.lat, fallbackCenter.lng]);

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0" />
      {pins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="font-mono text-xs text-mute tracking-widest uppercase bg-void/80 px-3 py-2">
            No location pins yet — experiences still listed below
          </p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
