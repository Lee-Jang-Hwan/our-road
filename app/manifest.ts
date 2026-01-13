import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RootUs - ?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
    short_name: "RootUs",
    description: "?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
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

