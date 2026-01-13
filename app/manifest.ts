import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RootUs - 우리한테 딱 맞는 여행&데이트 코스",
    short_name: "RootUs",
    description: "우리한테 딱 맞는 여행&데이트 코스",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/2026.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/2026.png",
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

