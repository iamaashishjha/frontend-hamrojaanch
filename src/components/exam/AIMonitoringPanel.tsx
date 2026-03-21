import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, Volume2, Monitor, User, Video, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface MonitoringStatus {
  face: "detected" | "not-detected" | "multiple";
  gaze: "focused" | "away" | "warning";
  noise: "quiet" | "noisy" | "warning";
  screen: "normal" | "tab-switch" | "warning";
}

interface AIMonitoringPanelProps {
  /** Live MediaStream from getUserMedia — renders a <video> element */
  stream?: MediaStream | null;
  /** Fallback static image URL (legacy) */
  cameraPreviewUrl?: string;
  status: MonitoringStatus;
  warningCount: number;
  maxWarnings: number;
  onViewLog: () => void;
  /** Optional block to render in the top blank area (e.g. Live Proctor Feed) */
  topSlot?: React.ReactNode;
}

const statusLabels = {
  face: {
    detected: { label: "Face Visible", variant: "success-light" as const },
    "not-detected": { label: "Face Not Visible", variant: "danger-light" as const },
    multiple: { label: "Multiple Faces", variant: "warning-light" as const },
  },
  gaze: {
    focused: { label: "Focused", variant: "success-light" as const },
    away: { label: "Looking Away", variant: "warning-light" as const },
    warning: { label: "Extended Away", variant: "danger-light" as const },
  },
  noise: {
    quiet: { label: "Quiet", variant: "success-light" as const },
    noisy: { label: "Background Noise", variant: "warning-light" as const },
    warning: { label: "High Noise", variant: "danger-light" as const },
  },
  screen: {
    normal: { label: "Normal", variant: "success-light" as const },
    "tab-switch": { label: "Tab Switch", variant: "warning-light" as const },
    warning: { label: "Suspicious Activity", variant: "danger-light" as const },
  },
};

/**
 * AIMonitoringPanel — shows the live camera feed + monitoring indicators
 * during the exam.
 *
 * WHY rewritten: The old version only accepted a static image URL.
 * The proctoring flow acquires a real MediaStream, which must be
 * rendered via a <video> element using a callback ref.
 */
export function AIMonitoringPanel({
  stream,
  cameraPreviewUrl,
  status,
  warningCount,
  maxWarnings,
  onViewLog,
  topSlot,
}: AIMonitoringPanelProps) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Callback ref — attaches stream when the <video> mounts or stream changes
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElRef.current = node;
      if (node && stream) {
        node.srcObject = stream;
        node.play()
          .then(() => setVideoPlaying(true))
          .catch(() => setVideoPlaying(false));
      }
    },
    [stream],
  );

  // Re-attach when stream changes after mount
  useEffect(() => {
    const el = videoElRef.current;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play()
          .then(() => setVideoPlaying(true))
          .catch(() => setVideoPlaying(false));
      }
    } else {
      setVideoPlaying(false);
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0;

  return (
    <div className="bg-card rounded-xl border p-3 space-y-3 mt-0">
      {topSlot ? <div className="mt-1 mb-1 pb-0">{topSlot}</div> : null}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
          AI Monitoring
        </h3>
        {hasVideo && videoPlaying ? (
          <Badge variant="success-light" className="gap-1 text-[10px] px-1.5 py-0">
            <Video className="h-2.5 w-2.5" />
            Live
          </Badge>
        ) : (
          <Badge variant="danger-light" className="gap-1 text-[10px] px-1.5 py-0">
            <VideoOff className="h-2.5 w-2.5" />
            Offline
          </Badge>
        )}
      </div>

      {/* Camera Preview — live video or fallback */}
      <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : cameraPreviewUrl ? (
          <img
            src={cameraPreviewUrl}
            alt="Camera preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </div>
        )}
        {/* Face detection overlay */}
        {hasVideo && (
          <div className="absolute inset-4 border-2 border-primary/50 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* Status Indicators */}
      <div className="space-y-1.5">
        <StatusRow
          icon={<User className="h-3.5 w-3.5" />}
          label="Face Status"
          status={statusLabels.face[status.face]}
        />
        <StatusRow
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Gaze Status"
          status={statusLabels.gaze[status.gaze]}
        />
        <StatusRow
          icon={<Volume2 className="h-3.5 w-3.5" />}
          label="Noise Level"
          status={statusLabels.noise[status.noise]}
        />
        <StatusRow
          icon={<Monitor className="h-3.5 w-3.5" />}
          label="Screen Activity"
          status={statusLabels.screen[status.screen]}
        />
      </div>

      {/* Warning Counter */}
      <div className="flex items-center justify-between p-2 bg-secondary rounded-lg">
        <span className="text-[11px] font-medium">Warning Count</span>
        <span
          className={cn(
            "text-[11px] font-mono font-bold",
            warningCount === 0 && "text-success",
            warningCount > 0 && warningCount < maxWarnings && "text-warning",
            warningCount >= maxWarnings && "text-danger"
          )}
        >
          {warningCount}/{maxWarnings}
        </span>
      </div>

      {/* View Log Button (width 65% of container = 35% decrease) */}
      <div className="flex justify-center">
        <Button variant="outline" className="w-[65%] text-[11px]" onClick={onViewLog}>
          View Monitoring Log
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-[10px] text-muted-foreground text-center">
        AI monitoring helps ensure exam integrity. Please keep your face visible and stay focused.
      </p>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: { label: string; variant: "success-light" | "warning-light" | "danger-light" };
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant={status.variant} className="text-[10px] py-0 px-1.5">{status.label}</Badge>
    </div>
  );
}
