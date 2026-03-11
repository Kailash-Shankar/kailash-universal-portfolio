"use client";

import { useEffect, useRef } from "react";

export default function LandingAudio() {
  const audioRef = useRef(null);

  useEffect(() => {
    const playAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener("click", playAudio);
    };

    window.addEventListener("click", playAudio);

    return () => window.removeEventListener("click", playAudio);
  }, []);

  return (
    <audio ref={audioRef}>
      <source src="/audio/universal_pictures.mp3" type="audio/mpeg" />
    </audio>
  );
}