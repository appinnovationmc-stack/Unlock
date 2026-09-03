import type { StyleSpecification } from "maplibre-gl";

/**
 * Original paper field.
 * Carto light_all when NEXT_PUBLIC_CARTO_KEY is set.
 * Esri Light Gray Canvas + labels otherwise.
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
        attribution: "Tiles © Esri"
      },
      labels: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256
      }
    },
    layers: [
      { id: "paper", type: "raster", source: "paper" },
      { id: "labels", type: "raster", source: "labels" }
    ]
  };
}
