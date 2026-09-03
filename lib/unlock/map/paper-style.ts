import type { StyleSpecification } from "maplibre-gl";

/**
 * Carto Voyager when NEXT_PUBLIC_CARTO_KEY is set.
 * URL matches CARTO's issued raster pattern (no @2x — that 404s).
 * Fallback is Esri World Street Map, not Light Gray (that prints
 * "Map data not yet available" at street zoom).
 */
export function paperMapStyle(): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_CARTO_KEY?.trim();
  if (key) {
    const q = `key=${encodeURIComponent(key)}`;
    return {
      version: 8,
      sources: {
        paper: {
          type: "raster",
          tiles: [`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?${q}`],
          tileSize: 256,
          attribution: "© OpenStreetMap © CARTO"
        }
      },
      layers: [{ id: "paper", type: "raster", source: "paper" }]
    };
  }

  return {
    version: 8,
    sources: {
      paper: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        attribution: "Tiles © Esri"
      }
    },
    layers: [{ id: "paper", type: "raster", source: "paper" }]
  };
}
