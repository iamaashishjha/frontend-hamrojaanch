import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";

interface QuestionNavStripProps {
  totalQuestions: number;
  currentQuestion: number;
  answeredQuestions: number[];
  flaggedQuestions: number[];
  /** Optional list of questions that have AI flags (red dot indicator). */
  aiFlaggedQuestions?: number[];
  onQuestionSelect: (questionNumber: number) => void;
}

export function QuestionNavStrip({
  totalQuestions,
  currentQuestion,
  answeredQuestions,
  flaggedQuestions,
  aiFlaggedQuestions = [],
  onQuestionSelect,
}: QuestionNavStripProps) {
  // NOTE: Pagination is UI-only. It never changes the underlying
  // answer-saving or navigation behavior — we still call onQuestionSelect
  // with the selected question number.
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalQuestions, 1) / pageSize));
  const [page, setPage] = useState(1);

  // Sync page when currentQuestion changes (e.g. from center Prev/Next) so this list shows the right page.
  useEffect(() => {
    if (totalQuestions === 0) return;
    const targetPage = Math.min(
      totalPages,
      Math.max(1, Math.floor((currentQuestion - 1) / pageSize) + 1)
    );
    setPage((p) => (p === targetPage ? p : targetPage));
  }, [currentQuestion, totalQuestions, totalPages, pageSize]);

  const getQuestionStatus = (questionNumber: number) => {
    if (questionNumber === currentQuestion) return "current";
    if (flaggedQuestions.includes(questionNumber)) return "flagged";
    if (answeredQuestions.includes(questionNumber)) return "answered";
    return "unanswered";
  };

  const getRowClass = (status: string) => {
    if (status === "current") {
      return "bg-white/90 border-l-4 border-[var(--nav-active-bg)] shadow-sm";
    }
    return "bg-white/70 hover:bg-white/90";
  };

  const getBubbleClass = (status: string) => {
    switch (status) {
      case "current":
        return "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)]";
      case "answered":
        return "bg-[var(--nav-answered-bg)] text-[var(--nav-answered-text)] border border-[var(--nav-answered-border)]";
      case "flagged":
        return "bg-[var(--nav-flagged-bg)] text-[var(--nav-flagged-text)] border border-[var(--nav-flagged-border)]";
      default:
        return "bg-[var(--nav-unanswered-bg)] text-[var(--nav-unanswered-text)] border border-[var(--nav-unanswered-border)]";
    }
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalQuestions, start + pageSize - 1);

  const pageNumbers: number[] =
    totalQuestions === 0
      ? []
      : Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="h-full flex flex-col w-full max-w-full">
      {/* Header: Question Navigator title (center-aligned) */}
      <h2 className="text-[13px] font-semibold text-[var(--nav-unanswered-text)] mb-2 text-center">
        Question Navigator
      </h2>

      {/* Question rows */}
      <div className="space-y-0.5 mb-2">
        {pageNumbers.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No questions available.</p>
        )}
        {pageNumbers.map((num) => {
          const status = getQuestionStatus(num);
          const isAnswered = answeredQuestions.includes(num);
          const isFlagged = flaggedQuestions.includes(num);
          const isAiFlagged = aiFlaggedQuestions.includes(num);

          return (
            <button
              key={num}
              type="button"
              onClick={() => onQuestionSelect(num)}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-card)] text-[11px] sm:text-[13px] transition-colors border border-transparent",
                getRowClass(status)
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold",
                    getBubbleClass(status)
                  )}
                >
                  {num}
                </div>
                <span className="truncate text-[var(--nav-unanswered-text)] font-medium">
                  Question {num}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isAnswered && (
                  <span className="w-4 h-4 rounded-md bg-[var(--nav-answered-bg)] border border-[var(--nav-answered-border)] flex items-center justify-center text-[10px] text-[var(--nav-answered-text)]">
                    ✓
                  </span>
                )}
                {isFlagged && (
                  <span className="w-4 h-4 rounded-md bg-[var(--nav-flagged-bg)] border border-[var(--nav-flagged-border)] flex items-center justify-center">
                    <Flag className="h-3 w-3 text-[var(--nav-flagged-text)]" />
                  </span>
                )}
                {isAiFlagged && (
                  <span className="w-3 h-3 rounded-full bg-[var(--nav-ai-flagged-bg)] border border-[var(--nav-ai-flagged-border)]" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination: one light-button group */}
      <div className="rounded-[var(--radius-button)] bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-border)] p-2 mb-2 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <button
            type="button"
            onClick={() => {
              if (page <= 1) return;
              const prevPage = page - 1;
              setPage(prevPage);
              onQuestionSelect((prevPage - 1) * pageSize + 1);
            }}
            disabled={page <= 1}
            className="flex-1 min-w-0 py-1.5 px-2 rounded-[var(--radius-navigator)] text-[11px] font-medium text-[var(--btn-secondary-text)] bg-white border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-[11px] font-medium text-[var(--nav-unanswered-text)] shrink-0 px-1">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => {
              if (page >= totalPages) return;
              const nextPage = page + 1;
              setPage(nextPage);
              onQuestionSelect((nextPage - 1) * pageSize + 1);
            }}
            disabled={page >= totalPages}
            className="flex-1 min-w-0 py-1.5 px-2 rounded-[var(--radius-navigator)] text-[11px] font-medium text-[var(--btn-secondary-text)] bg-white border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {(() => {
              const pills: number[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pills.push(i);
              } else {
                pills.push(1);
                const low = Math.max(2, page - 1);
                const high = Math.min(totalPages - 1, page + 1);
                if (low > 2) pills.push(-1);
                for (let i = low; i <= high; i++) if (i !== 1 && i !== totalPages) pills.push(i);
                if (high < totalPages - 1) pills.push(-2);
                if (totalPages > 1) pills.push(totalPages);
              }
              return pills.map((p) =>
                p < 0 ? (
                  <span key={p} className="px-1 text-[var(--nav-unanswered-text)] text-[11px]">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPage(p);
                      onQuestionSelect((p - 1) * pageSize + 1);
                    }}
                    className={cn(
                      "min-w-[26px] h-6 rounded-[var(--radius-navigator)] text-[11px] font-medium flex items-center justify-center border transition-colors",
                      p === page
                        ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]"
                        : "bg-white text-[var(--nav-unanswered-text)] border-[var(--nav-unanswered-border)] hover:bg-[var(--btn-secondary-hover)]"
                    )}
                  >
                    {p}
                  </button>
                )
              );
            })()}
          </div>
        )}
      </div>

      {/* Legend moved to center column (below action row, above submit block) */}
    </div>
  );
}
