import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useExamSession } from "@/hooks/useExamSession";
import { getAttemptProctorSummary } from "@/lib/question-bank-api";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

export default function SuccessPage() {
  const navigate = useNavigate();
  const { state: session, reset } = useExamSession();
  const submission = session.lastSubmission;
  const [proctorSummary, setProctorSummary] = useState<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!session.attemptId) return;
      try {
        const summary = await getAttemptProctorSummary(session.attemptId);
        setProctorSummary(summary);
      } catch {
        setProctorSummary(null);
      }
    };
    void loadSummary();
  }, [session.attemptId]);

  const answeredCount = submission?.answered ?? 0;
  const flaggedCount = submission?.flagged ?? 0;
  const totalQuestions = submission?.totalQuestions ?? Math.max(answeredCount, 1);
  const skippedCount = Math.max(0, totalQuestions - answeredCount);
  const durationText = submission?.durationSeconds
    ? formatDuration(submission.durationSeconds)
    : "—";
  const referenceId =
    session.attemptId && submission?.submittedAt
      ? `EXM-${new Date(submission.submittedAt).getFullYear()}-${session.attemptId.slice(-8).toUpperCase()}`
      : `EXM-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const handleDownloadConfirmation = () => {
    const submittedAt = submission?.submittedAt
      ? new Date(submission.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu" })
      : new Date().toLocaleString("en-GB", { timeZone: "Asia/Kathmandu" });

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Watermark: HamroJaanch — diagonal, semi-transparent, centered
    doc.addGState(
      "watermark",
      doc.GState({
        opacity: 0.2,
        "stroke-opacity": 0.2,
        "fill-opacity": 0.2,
      } as Parameters<jsPDF["GState"]>[0])
    );
    doc.setGState("watermark");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(44);
    doc.text("HamroJaanch", pageWidth / 2, pageHeight / 2, {
      align: "center",
      baseline: "middle",
      angle: -45,
    });
    doc.setGState(doc.GState({ opacity: 1 } as Parameters<jsPDF["GState"]>[0]));
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    // Content
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("EXAM SUBMISSION CONFIRMATION", pageWidth / 2, y, { align: "center" });
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text(`Reference ID:   ${referenceId}`, margin, y);
    y += 16;
    doc.text(`Exam:           ${submission?.examName ?? session.examId ?? "—"}`, margin, y);
    y += 14;
    doc.text(`Attempt ID:     ${session.attemptId ?? "—"}`, margin, y);
    y += 14;
    doc.text(`Submitted at:   ${submittedAt} (Asia/Kathmandu)`, margin, y);
    y += 22;

    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(`Questions answered:  ${answeredCount}`, margin, y);
    y += 14;
    doc.text(`Questions total:     ${totalQuestions}`, margin, y);
    y += 14;
    doc.text(`Flagged for review:  ${flaggedCount}`, margin, y);
    y += 14;
    doc.text(`Skipped:             ${skippedCount}`, margin, y);
    y += 14;
    doc.text(`Duration:            ${durationText}`, margin, y);
    y += 22;

    doc.setFont("helvetica", "bold");
    doc.text("PROCTORING", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(`Events logged:  ${proctorSummary?.total ?? 0}`, margin, y);
    y += 14;
    doc.text(
      `Warnings:       ${(proctorSummary?.bySeverity?.medium ?? 0) + (proctorSummary?.bySeverity?.high ?? 0)}`,
      margin,
      y
    );
    y += 14;
    doc.text("Status:         Completed", margin, y);
    y += 22;

    const footer =
      "This document confirms that your exam was submitted successfully. Results will be available as per your institution's policy.";
    const split = doc.splitTextToSize(footer, pageWidth - 2 * margin);
    doc.text(split, margin, y);

    const filename = `exam-confirmation-${referenceId.replace(/\s/g, "-")}.pdf`;
    doc.save(filename);
    toast.success("Confirmation downloaded", {
      description: "Your exam submission confirmation (PDF) has been saved.",
    });
  };

  const proctorWarnings =
    (proctorSummary?.bySeverity.medium ?? 0) + (proctorSummary?.bySeverity.high ?? 0);
  const proctorEventsLogged = proctorSummary?.total ?? 0;
  const warningCount = proctorSummary ? proctorWarnings : flaggedCount;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: "linear-gradient(135deg, #EEF2FF 0%, #DCFCE7 100%)",
        fontFamily:
          '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="w-full max-w-[720px] bg-white rounded-[20px] shadow-[0_20px_40px_rgba(15,23,42,0.16)] px-6 py-8 sm:px-10 sm:py-10">
        {/* Proctored badge */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ECFEFF] px-4 py-1 text-xs font-medium text-[#0369A1]">
            <Shield className="h-3.5 w-3.5" />
            <span>Proctored &amp; Verified Submission</span>
          </div>
        </div>

        {/* Top success section */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#DCFCE7]">
            <CheckCircle2 className="h-10 w-10 text-[#16A34A]" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">
            Exam Submitted Successfully
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#475569]">
            Your exam has been securely recorded and submitted.
          </p>
        </div>

        {/* Reference details */}
        <section
          aria-labelledby="reference-details-heading"
          className="mb-8"
        >
          <h2
            id="reference-details-heading"
            className="mb-3 text-xs font-semibold tracking-[0.18em] text-[#64748B]"
          >
            REFERENCE DETAILS
          </h2>
          <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 sm:px-5 sm:py-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-[#64748B]">
                  Reference ID
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#0F172A] break-all">
                  {referenceId}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#64748B]">Exam</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                  {submission?.examName ?? session.examId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#64748B]">
                  Attempt ID
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#0F172A] break-all">
                  {session.attemptId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[#64748B]">
                  Submitted at
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#0F172A]">
                  {submission?.submittedAt
                    ? new Date(submission.submittedAt).toLocaleString("en-GB", {
                        timeZone: "Asia/Kathmandu",
                      })
                    : "—"}{" "}
                  {submission?.submittedAt ? "(Asia/Kathmandu)" : ""}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Summary stat cards */}
        <section
          aria-labelledby="summary-heading"
          className="mb-8"
        >
          <h2
            id="summary-heading"
            className="mb-3 text-xs font-semibold tracking-[0.18em] text-[#64748B]"
          >
            SUMMARY
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-[#F1F5F9] px-3 py-3 text-center">
              <p className="text-[22px] font-bold text-[#2563EB]">
                {answeredCount}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Answered
              </p>
            </div>
            <div className="rounded-xl bg-[#F1F5F9] px-3 py-3 text-center">
              <p className="text-[22px] font-bold text-[#2563EB]">
                {totalQuestions}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Total
              </p>
            </div>
            <div className="rounded-xl bg-[#F1F5F9] px-3 py-3 text-center">
              <p className="text-[22px] font-bold text-[#2563EB]">
                {skippedCount}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Skipped
              </p>
            </div>
            <div className="rounded-xl bg-[#F1F5F9] px-3 py-3 text-center">
              <p className="text-[22px] font-bold text-[#2563EB]">
                {flaggedCount}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Flagged
              </p>
            </div>
          </div>
        </section>

        {/* Proctoring badges */}
        <section
          aria-labelledby="proctoring-heading"
          className="mb-8"
        >
          <h2
            id="proctoring-heading"
            className="mb-3 text-xs font-semibold tracking-[0.18em] text-[#64748B]"
          >
            PROCTORING
          </h2>
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ECFEFF] px-4 py-1.5 text-xs font-medium text-[#0369A1]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {proctorEventsLogged}{" "}
                {proctorEventsLogged === 1 ? "Event Logged" : "Events Logged"}
              </span>
            </div>

            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium ${
                warningCount > 0
                  ? "bg-[#FEF3C7] text-[#92400E]"
                  : "bg-[#DCFCE7] text-[#166534]"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {warningCount}{" "}
                {warningCount === 1 ? "Warning" : "Warnings"}
              </span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-[#DCFCE7] px-4 py-1.5 text-xs font-medium text-[#166534]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completed</span>
            </div>
          </div>
        </section>

        {/* Footer message */}
        <p className="mb-8 text-center text-sm text-[#475569]">
          Your exam has been successfully submitted and securely stored.
          <br className="hidden sm:block" />
          Results will be published according to your institution&apos;s policy.
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            variant="outline"
            className="w-full rounded-[12px] border border-[#CBD5E1] bg-transparent text-sm font-medium text-[#334155] hover:bg-[#E2E8F0] sm:w-auto px-6 py-3"
            onClick={handleDownloadConfirmation}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Submission Receipt
          </Button>
          <Button
            className="w-full rounded-[12px] bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8] sm:w-auto"
            onClick={() => {
              reset();
              navigate("/student");
            }}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}


