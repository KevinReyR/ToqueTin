import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fafaf9",
    description: "Seguimiento seguro de pedidos para restaurantes.",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    name: "ToqueTin",
    orientation: "portrait",
    short_name: "ToqueTin",
    start_url: "/track",
    theme_color: "#92400e",
  };
}
