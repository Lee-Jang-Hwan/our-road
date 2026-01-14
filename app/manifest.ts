import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RootUs - 스마트한 여행 일정 & 경로 최적화",
    short_name: "RootUs",
    description: "스마트한 여행 일정 & 경로 최적화",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/RUrogo.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/RUrogo.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["travel", "lifestyle", "navigation"],
    lang: "ko",
    dir: "ltr",
  };
}

