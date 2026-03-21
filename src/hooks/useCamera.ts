import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useCamera — manages webcam access for proctoring / system check.
 *
 * WHY callback-ref pattern:
 * The <video> element is conditionally rendered ({isActive ? <video> : placeholder}).
 * With a normal useRef, the ref is null when getUserMedia resolves because React
 * hasn't re-rendered yet. A callback ref fires the moment the element enters the
 * DOM, so we can attach the stream immediately — regardless of timing.
 */
export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const startingRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [permissionState, setPermissionState] = useState<
    PermissionState | "unsupported" | "unknown"
  >("unknown");
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [secureContext, setSecureContext] = useState(true);

  // ── Attach helper — wires stream ↔ video whenever both exist ──
  const attachStream = useCallback(() => {
    const el = videoElRef.current;
    const stream = streamRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }
  }, []);

  // ── Callback ref — called by React when <video ref={videoRef}> mounts/unmounts ──
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElRef.current = node;
      if (node) {
        attachStream(); // element just appeared — attach if stream is ready
      }
    },
    [attachStream],
  );

  // ── Start camera ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    // Clear any stale state so a retry always works
    if (startingRef.current) return; // prevent concurrent starts
    startingRef.current = true;

    // Stop any existing stream before re-acquiring
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported in this browser or context.");
      setIsActive(false);
      startingRef.current = false;
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Camera requires a secure context (HTTPS or localhost).");
      setIsActive(false);
      startingRef.current = false;
      return;
    }

    // Check permission state (informational)
    if (navigator?.permissions?.query) {
      try {
        const status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        setPermissionState(status.state);
        status.onchange = () => setPermissionState(status.state);
      } catch {
        setPermissionState("unknown");
      }
    } else {
      setPermissionState("unsupported");
    }

    // Count video devices (informational)
    if (navigator?.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setDeviceCount(devices.filter((d) => d.kind === "videoinput").length);
      } catch {
        setDeviceCount(null);
      }
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = mediaStream;
      setError(null);
      setIsActive(true);

      // Try attaching immediately (video element may already be in DOM from a previous render)
      attachStream();
    } catch (err) {
      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            setError("Camera access denied. Please allow camera access in your browser settings.");
            break;
          case "NotFoundError":
            setError("No camera device found. Please connect a camera and retry.");
            break;
          case "NotReadableError":
            setError("Camera is already in use by another application.");
            break;
          case "OverconstrainedError":
            setError("Camera does not support the requested resolution.");
            break;
          default:
            setError("Unable to access camera. Please check your device.");
        }
      } else {
        setError("Unable to access camera. Please check your device.");
      }
      setIsActive(false);
    } finally {
      startingRef.current = false;
    }
  }, [attachStream]);

  // ── Stop camera ───────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
    setIsActive(false);
    startingRef.current = false;
  }, []);

  // ── Fallback: when isActive flips to true, try attaching ──
  // This handles the case where the callback ref fires before the stream
  // and the stream arrives before React re-renders with the <video>.
  useEffect(() => {
    if (isActive) {
      // Small delay to let React commit the <video> element
      const raf = requestAnimationFrame(() => attachStream());
      return () => cancelAnimationFrame(raf);
    }
  }, [isActive, attachStream]);

  // ── Secure-context check & cleanup on unmount ─────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSecureContext(window.isSecureContext);
    }
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera,
    permissionState,
    deviceCount,
    secureContext,
  };
}
