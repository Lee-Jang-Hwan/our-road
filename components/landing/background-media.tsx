"use client";

export function BackgroundMedia() {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 z-0 h-full w-full object-cover object-center scale-105"
      ref={(video) => {
        if (video) video.playbackRate = 0.7;
      }}
    >
      <source
        src="/intro/Vertical_916_aspect_202601091805_yjc1y.mp4"
        type="video/mp4"
      />
    </video>
  );
}
