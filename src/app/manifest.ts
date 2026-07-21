import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Litmus",
    short_name: "Litmus",
    description:
      "Deterministic virtual chemistry labs for student practice and teacher authoring.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
