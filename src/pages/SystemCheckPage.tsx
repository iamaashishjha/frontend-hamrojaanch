import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusIndicator, StatusType } from "@/components/exam/StatusIndicator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useCamera } from "@/hooks/useCamera";
import { Camera, Mic, Monitor, Wifi, Sun, Volume2, ArrowRight, Info, AlertTriangle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useExamSession } from "@/hooks/useExamSession";

interface SystemCheck {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: StatusType;
}

export default function SystemCheckPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: session, switchExam } = useExamSession();
  const examId = searchParams.get("examId");
  const {
    videoRef,
    isActive: cameraActive,
    error: cameraError,
    startCamera,
    stopCamera,
    permissionState,
    deviceCount,
    secureContext,
  } = useCamera();
  const [consentChecked, setConsentChecked] = useState(false);
  const [allowCameraSkip, setAllowCameraSkip] = useState(false);
  const [cameraTimeout, setCameraTimeout] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const [checks, setChecks] = useState<SystemCheck[]>([
    { id: "camera", label: "Camera", description: "Checking camera access...", icon: Camera, status: "loading" },
    { id: "mic", label: "Microphone", description: "Checking microphone access...", icon: Mic, status: "loading" },
    { id: "screen", label: "Screen Share", description: "Ready to share screen", icon: Monitor, status: "loading" },
    { id: "internet", label: "Internet Connection", description: "Testing connection speed...", icon: Wifi, status: "loading" },
    { id: "lighting", label: "Lighting", description: "Analyzing lighting conditions...", icon: Sun, status: "loading" },
    { id: "noise", label: "Background Noise", description: "Checking audio environment...", icon: Volume2, status: "loading" },
  ]);

  useEffect(() => {
    if (examId && examId !== session.examId) {
      switchExam(examId);
    }
  }, [examId, session.examId, switchExam]);

  // Start camera on mount — both callbacks are stable (empty deps in useCamera)
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraActive || cameraError) {
      setCameraTimeout(false);
      return;
    }
    const timer = setTimeout(() => setCameraTimeout(true), 4000);
    return () => clearTimeout(timer);
  }, [cameraActive, cameraError]);

  // Simulate system checks (camera status comes from real webcam)
  useEffect(() => {
    const timer = setTimeout(() => {
      setChecks([
        {
          id: "camera",
          label: "Camera",
          description:
            cameraError ||
            (allowCameraSkip
              ? "Camera skipped for this session"
              : cameraActive
              ? "Camera is working properly"
              : "Waiting for camera..."),
          icon: Camera,
          status: cameraError
            ? "blocked"
            : allowCameraSkip
            ? "attention"
            : cameraActive
            ? "ready"
            : "loading",
        },
        { id: "mic", label: "Microphone", description: "Microphone is working properly", icon: Mic, status: "ready" },
        { id: "screen", label: "Screen Share", description: "Ready to share screen when exam starts", icon: Monitor, status: "ready" },
        { id: "internet", label: "Internet Connection", description: "Connection speed: 45 Mbps", icon: Wifi, status: "ready" },
        { id: "lighting", label: "Lighting", description: "Good lighting detected", icon: Sun, status: "ready" },
        { id: "noise", label: "Background Noise", description: "Environment is quiet", icon: Volume2, status: "ready" },
      ]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [cameraActive, cameraError, allowCameraSkip]);

  const cameraCheck = checks.find((check) => check.id === "camera");
  const otherChecksReady = checks.filter((check) => check.id !== "camera").every((check) => check.status === "ready");
  const canSkipCamera = import.meta.env.DEV && allowCameraSkip && otherChecksReady;
  const allReady = consentChecked && (checks.every((c) => c.status === "ready") || canSkipCamera);
  const progressReady = checks.reduce((count, check) => {
    if (check.id === "camera") {
      return count + (check.status === "ready" || canSkipCamera ? 1 : 0);
    }
    return count + (check.status === "ready" ? 1 : 0);
  }, 0);
  const progressPercent = Math.round((progressReady / checks.length) * 100);

  const stopMicTest = useCallback(() => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micAudioContextRef.current?.close();
    micAudioContextRef.current = null;
    setMicTesting(false);
    setMicLevel(0);
  }, []);

  const startMicTest = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicError("Microphone access is not supported in this browser.");
      return;
    }
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioContext = new AudioContext();
      micAudioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setMicLevel(Math.min(100, Math.round(rms * 200)));
        micRafRef.current = requestAnimationFrame(updateLevel);
      };

      setMicTesting(true);
      updateLevel();
    } catch (err) {
      setMicError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow access in your browser."
          : "Unable to access microphone."
      );
    }
  };

  useEffect(() => {
    return () => stopMicTest();
  }, [stopMicTest]);

  const playTestTone = () => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.05;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      oscillator.onended = () => audioContext.close();
    } catch {
      setMicError("Unable to play test sound in this browser.");
    }
  };

  return (
    <div className="min-h-screen bg-background public-page-scale">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText className="font-bold text-xl" />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {!examId && (
            <div className="mb-6 rounded-lg border border-warning/30 bg-warning-light p-4 text-sm text-muted-foreground">
              <p className="font-medium text-warning">No exam selected.</p>
              <p className="mt-1">
                Return to the exam marketplace to choose an exam before starting, or start a demo exam below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/all-exams")}
                >
                  Browse Exams
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("/system-check?examId=ex_demo")}
                >
                  Start demo exam
                </Button>
              </div>
            </div>
          )}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">System Check</h1>
              <p className="text-muted-foreground">
                Let's make sure everything is ready for your exam
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Camera Preview */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Camera Preview</h2>
              <div className="exam-card aspect-video relative overflow-hidden">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: "scaleX(-1)" }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {cameraError || "Starting camera..."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAllowCameraSkip(false);
                          stopCamera();
                          setTimeout(() => startCamera(), 50); // small delay to let React commit cleanup
                        }}
                      >
                        Retry Camera
                      </Button>
                    </div>
                  </div>
                )}
                {/* Face detection box overlay */}
                <div className="absolute inset-8 border-2 border-dashed border-primary/50 rounded-lg">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-card px-2 py-1 rounded text-xs font-medium text-primary">
                    Keep your face within this area
                  </div>
                </div>
                {/* Corner guides */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br" />
            </div>
              <p className="text-sm text-muted-foreground text-center">
                Position yourself so your face is clearly visible within the frame
              </p>
            {(cameraError || cameraTimeout) && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAllowCameraSkip(false);
                    stopCamera();
                    setTimeout(() => startCamera(), 50);
                  }}
                >
                  Start Camera
                </Button>
              </div>
            )}
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Secure Context:</span>
                  <Badge variant={secureContext ? "success-light" : "warning-light"}>
                    {secureContext ? "Yes" : "No"}
                  </Badge>
                  <span>Permission:</span>
                  <Badge variant="outline">{permissionState}</Badge>
                  <span>Devices:</span>
                  <Badge variant="outline">{deviceCount ?? "Unknown"}</Badge>
                </div>
                {!cameraActive && (
                  <p className="mt-2">
                    If permission is <strong>prompt</strong>, click "Retry Camera" to trigger the browser
                    permission dialog.
                  </p>
                )}
              </div>

              {/* Exam Integrity Warning */}
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 text-warning font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Exam Monitoring Notice</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs leading-relaxed">
                  <li>
                    For exam integrity, your <strong>camera</strong>, <strong>microphone</strong>, and{" "}
                    <strong>screen</strong> are being monitored.
                  </li>
                  <li>
                    Please remain in view, maintain a quiet environment, and follow all exam guidelines.
                  </li>
                  <li>
                    Failure to comply may lead to <strong>penalties</strong> or{" "}
                    <strong>exam cancellation</strong>.
                  </li>
                </ul>
              </div>
            {(cameraError || cameraTimeout) && (
              <div className="rounded-lg border border-warning/30 bg-warning-light p-3 text-xs text-muted-foreground">
                <p className="font-medium text-warning">Camera troubleshooting</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  <li>Allow camera permission in the browser address bar.</li>
                  <li>Close apps that may be using the camera (Zoom/Meet/Teams).</li>
                  <li>Ensure Windows camera privacy settings are enabled.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Right: Checklist */}
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">System Requirements</h2>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              {checks.map((check) => (
                <StatusIndicator
                  key={check.id}
                  status={check.status}
                  label={check.label}
                  description={check.description}
                />
              ))}
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <h3 className="text-sm font-semibold">Microphone Test</h3>
              <p className="text-xs text-muted-foreground">
                Speak to see input level. Play a test tone to confirm speaker output.
              </p>
              <div className="mt-3 space-y-3">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-success transition-all"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
                {micError ? <p className="text-xs text-danger">{micError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {micTesting ? (
                    <Button variant="outline" size="sm" onClick={stopMicTest}>
                      Stop Test
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={startMicTest}>
                      Start Test
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={playTestTone}>
                    Play Test Sound
                  </Button>
                </div>
              </div>
            </div>

            {/* Consent Section */}
            <div className="exam-card p-4 mt-6">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="consent" className="text-sm font-medium cursor-pointer">
                      I consent to AI monitoring during this exam
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your camera and screen will be monitored to ensure exam integrity. All data is encrypted and handled according to our privacy policy.
                    </p>
                    {import.meta.env.DEV && (cameraError || cameraTimeout) && (
                      <div className="mt-4 rounded-lg border border-warning/30 bg-warning-light p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-warning">Camera blocked in this browser.</p>
                        <p className="mt-1">
                          For development, you can proceed without camera access.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Checkbox
                            id="camera-skip"
                            checked={allowCameraSkip}
                            onCheckedChange={(checked) => setAllowCameraSkip(checked === true)}
                          />
                          <label htmlFor="camera-skip" className="text-sm cursor-pointer">
                            Proceed without camera (dev only)
                          </label>
                        </div>
                      </div>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="link" size="sm" className="px-0 h-auto mt-1">
                          <Info className="h-3 w-3 mr-1" />
                          Learn more about AI monitoring
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>About AI Monitoring</DialogTitle>
                          <DialogDescription>
                            Understanding how we ensure exam integrity
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4 text-sm">
                          <div>
                            <h4 className="font-medium mb-1">What we monitor</h4>
                            <p className="text-muted-foreground">
                              Our AI analyzes video and audio to detect potential irregularities such as multiple faces, extended periods looking away, or unusual background noise.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-1">Your privacy</h4>
                            <p className="text-muted-foreground">
                              Recordings are encrypted and stored securely. Only authorized personnel can review flagged events. Data is deleted after the review period.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-1">Fair review process</h4>
                            <p className="text-muted-foreground">
                              AI flags are reviewed by humans before any action is taken. You'll have the opportunity to explain any flagged events.
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-center mt-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="xl"
                    onClick={() =>
                      navigate(examId ? `/instructions?examId=${examId}` : "/instructions")
                    }
                    disabled={!allReady}
                  >
                    Continue to Instructions
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!allReady && (
                <TooltipContent>
                  <p>Complete all checks and provide consent to continue</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </main>
    </div>
  );
}


