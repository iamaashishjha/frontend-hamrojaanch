import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowRight, Eye, Volume2, Monitor, Clock, AlertTriangle, HelpCircle, MessageSquare, ShieldCheck, Lock } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getExam } from "@/lib/exams-module-api";
import type { AdminExam } from "@/lib/exams-module-types";
import { getExamAccessDecision } from "@/lib/payments-api";
import { useExamSession } from "@/hooks/useExamSession";
import type { AccessDecision } from "@/lib/payments-types";
import { getStoredUser } from "@/lib/auth-api";

const rules = [
  {
    icon: Eye,
    title: "Keep your face visible",
    description: "Stay within the camera frame throughout the exam. Brief moments of looking away are normal, but extended periods may be logged.",
  },
  {
    icon: Volume2,
    title: "Maintain a quiet environment",
    description: "Find a quiet space with minimal background noise. Conversations or unusual sounds may be flagged for review.",
  },
  {
    icon: Monitor,
    title: "Stay on the exam screen",
    description: "Do not switch tabs or applications during the exam. All screen activity is monitored.",
  },
  {
    icon: Clock,
    title: "Manage your time",
    description: "Keep track of the timer. Once time expires, your exam will be automatically submitted.",
  },
  {
    icon: AlertTriangle,
    title: "Three warnings policy",
    description: "After three logged warnings, your exam may be paused for review. Stay focused to avoid interruptions.",
  },
  {
    icon: HelpCircle,
    title: "Technical issues",
    description: "If you experience technical difficulties, use the 'Report Issue' button. Your progress is auto-saved.",
  },
];

export default function InstructionsPage() {
  const navigate = useNavigate();
  const [understood, setUnderstood] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [searchParams] = useSearchParams();
  const { state: session, update } = useExamSession();
  const examId = searchParams.get("examId") ?? session.examId;
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [accessDecision, setAccessDecision] = useState<AccessDecision | null>(null);
  const [loading, setLoading] = useState(Boolean(examId));

  useEffect(() => {
    if (examId) {
      update({ examId });
    }
  }, [examId, update]);

  // Hydrate exam session with logged-in user's email so access checks see entitlements
  useEffect(() => {
    const user = getStoredUser();
    if (user?.email && !session.email) {
      update({ email: user.email });
    }
  }, [session.email, update]);

  useEffect(() => {
    const load = async () => {
      if (!examId) return;
      setLoading(true);
      try {
        const record = await getExam(examId);
        setExam(record);
        const isLoggedIn = typeof window !== "undefined" && window.localStorage.getItem("hj_registered") === "true";
        const decision = await getExamAccessDecision(examId, session.email || null, isLoggedIn);
        setAccessDecision(decision);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examId, session.email]);

  const totalQuestions = useMemo(() => {
    if (!exam) return 50;
    if (exam.questionsMode === "auto") {
      return exam.sectionsConfig.reduce((sum, section) => sum + section.questionCount, 0);
    }
    return exam.selectedQuestionIds.length;
  }, [exam]);

  const accessBlocked = accessDecision ? !accessDecision.hasAccess : false;

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
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Exam Instructions</h1>
            <p className="text-muted-foreground">
              Please read these guidelines carefully before starting
            </p>
          </div>

          {/* Exam Info Card */}
          <div className="exam-card p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Exam</p>
                <p className="font-semibold">{exam?.name ?? (loading ? "Loading..." : "Exam")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">
                  {exam ? `${exam.durationMinutes} minutes` : loading ? "Loading..." : "--"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Questions</p>
                <p className="font-semibold">
                  {exam ? `${totalQuestions} questions` : loading ? "Loading..." : "--"}
                </p>
              </div>
            </div>
          </div>

          {accessDecision && accessBlocked && (
            <div className="exam-card p-4 mb-6 bg-warning-light border-warning/30">
              <p className="font-medium text-warning">Access required</p>
              <p className="text-sm text-muted-foreground">
                {accessDecision.reason ?? "You need access before starting this exam."}
              </p>
              {accessDecision.requiresPayment && examId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/checkout?examId=${examId}`)}
                >
                  Go to Checkout
                </Button>
              )}
            </div>
          )}

          {/* Rules */}
          <div className="space-y-4 mb-8">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="exam-card p-4 flex items-start gap-4 hover:shadow-card-hover transition-shadow"
              >
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <rule.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{rule.title}</h3>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="exam-card p-4 mb-6 bg-primary-light border-primary/20">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Transparent Monitoring</p>
                <p className="text-sm text-muted-foreground">
                  You can view your monitoring log at any time during the exam. All events are recorded with clear, respectful language. We believe in transparency and fairness.
                </p>
              </div>
            </div>
          </div>

          {/* ── Legal Consent Section ─────────────────────── */}
          <div className="relative rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg overflow-hidden mb-8">
            {/* Header stripe */}
            <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/15">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Exam Monitoring &amp; Recording Consent
                </h2>
                <p className="text-xs text-muted-foreground">
                  Before starting your exam, please read carefully
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Legal terms */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                By proceeding, you acknowledge and agree that:
              </p>

              <ol className="space-y-3 text-sm">
                {[
                  "This examination is conducted under AI and/or live proctoring supervision.",
                  "Your webcam, microphone, and screen activity will be recorded.",
                  "Biometric data (including facial recognition and behavior analysis) may be used to verify identity and ensure exam integrity.",
                  "Your session data, recordings, logs, and exam responses will be securely stored for review, audit, and compliance purposes.",
                  "Suspicious activity may result in warnings, flags, investigation, score invalidation, or exam termination.",
                  "All collected data will be processed in accordance with applicable data protection and privacy regulations.",
                ].map((text, idx) => (
                  <li key={idx} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed pt-0.5">{text}</span>
                  </li>
                ))}
              </ol>

              {/* Divider */}
              <div className="border-t border-dashed border-primary/20" />

              {/* By clicking section */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  By clicking &quot;I Agree &amp; Start Exam&quot;, you:
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    Confirm that you understand and accept these conditions.
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    Consent to monitoring and recording.
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                    Confirm that you are taking this exam without unauthorized assistance.
                  </li>
                </ul>
              </div>

              {/* Exit notice */}
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If you do not agree, please <strong>exit the examination now</strong>. Continuing
                  constitutes acceptance of all terms above.
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-primary/10" />

              {/* Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="consent" className="text-sm font-medium cursor-pointer leading-snug">
                    I have read and agree to the monitoring and privacy terms.
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="understood"
                    checked={understood}
                    onCheckedChange={(checked) => setUnderstood(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="understood" className="text-sm font-medium cursor-pointer leading-snug">
                    I have read and understood the exam instructions and rules.
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex justify-center">
            <Button
              size="xl"
              onClick={() => {
                if (consentChecked) update({ consentGiven: true });
                navigate(examId ? `/exam?examId=${examId}` : "/exam");
              }}
              disabled={!understood || !consentChecked || accessBlocked || loading}
              className="gap-2"
            >
              <ShieldCheck className="h-5 w-5" />
              I Agree &amp; Start Exam
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}


