import type { StyleSpecification } from "maplibre-gl";

const ESRI_STREETS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

/**
 * City: paper field.
 * Street (z13+): Esri World Street always, so Find me never hits empty Light Gray tiles.
 * Carto light_all sits under that when NEXT_PUBLIC_CARTO_KEY is on the build.
 */
export function paperMapStyle(): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_CARTO_KEY?.trim();

  const streets = {
    type: "raster" as const,
    tiles: [ESRI_STREETS],
    tileSize: 256,
    minzoom: 13,
    maxzoom: 19,
    attribution: "Tiles © Esri"
  };

  if (key) {
    const q = `key=${encodeURIComponent(key)}`;
    return {
      version: 8,
      sources: {
        paper: {
          type: "raster",
          tiles: [`https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png?${q}`],
          tileSize: 256,
          maxzoom: 18,
          attribution: "© OpenStreetMap © CARTO"
        },
        streets
      },
      layers: [
        { id: "paper", type: "raster", source: "paper" },
        { id: "streets", type: "raster", source: "streets", minzoom: 13 }
      ]
    };
  }

  return {
    version: 8,
    sources: {
      paper: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        maxzoom: 13,
        attribution: "Tiles © Esri"
      },
      labels: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        maxzoom: 13
      },
      streets
    },
    layers: [
      { id: "paper", type: "raster", source: "paper", maxzoom: 14 },
      { id: "labels", type: "raster", source: "labels", maxzoom: 14 },
      { id: "streets", type: "raster", source: "streets", minzoom: 13 }
    ]
  };
}
