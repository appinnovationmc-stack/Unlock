import type { StyleSpecification } from "maplibre-gl";

/**
 * Paper field at city zoom. Real streets when you go closer.
 * Carto light_all covers both if NEXT_PUBLIC_CARTO_KEY is set.
 * Without a key: Esri Light Gray to z13, Esri World Street from z13.
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
          tiles: [`https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png?${q}`],
          tileSize: 256,
          maxzoom: 18,
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
      streets: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        minzoom: 13,
        maxzoom: 19,
        attribution: "Tiles © Esri"
      }
    },
    layers: [
      { id: "paper", type: "raster", source: "paper", maxzoom: 14 },
      { id: "labels", type: "raster", source: "labels", maxzoom: 14 },
      { id: "streets", type: "raster", source: "streets", minzoom: 13 }
    ]
  };
}
