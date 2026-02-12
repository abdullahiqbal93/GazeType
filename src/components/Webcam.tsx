'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';

interface WebcamProps {
  onStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  className?: string;
  width?: number;
  height?: number;
  showPreview?: boolean;
}

export interface WebcamHandle {
  getVideo: () => HTMLVideoElement | null;
  stop: () => void;
}

/**
 * Webcam component: handles getUserMedia permission and provides video element.
 * Camera frames stay local — never uploaded anywhere.
 */
const Webcam = forwardRef<WebcamHandle, WebcamProps>(function Webcam(
  { onStream, onError, className = '', width = 640, height = 480, showPreview = true },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    stop: () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsActive(false);
      }
    },
  }));

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsActive(true);
        onStream?.(stream);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Camera access denied'));
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        width={width}
        height={height}
        autoPlay
        playsInline
        muted
        className={showPreview ? 'rounded-lg shadow-md' : 'absolute opacity-0 pointer-events-none'}
        style={showPreview ? { transform: 'scaleX(-1)' } : { width: 1, height: 1 }}
      />
      {isActive && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-xs text-white">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Camera On
        </div>
      )}
    </div>
  );
});

export default Webcam;
