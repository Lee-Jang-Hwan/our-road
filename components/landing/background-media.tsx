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
        if (video) video.playbackRate = 0.9;
      }}
    >
      <source
        src="/intro/0109.mp4"
        type="video/mp4"
      />
    </video>
  );
}
