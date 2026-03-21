import { useCallback } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

export interface ExamSubmissionSummary {
  examId: string;
  examName?: string;
  answered: number;
  flagged: number;
  totalQuestions?: number;
  durationSeconds?: number;
  submittedAt: string;
}

export interface ExamSessionState {
  examId: string;
  email: string;
  currentQuestion: number;
  selectedAnswers: Record<string, string>;
  flaggedQuestions: number[];
  attemptId?: string;
  startedAt?: string;
  lastSavedAt?: string;
  lastSubmission?: ExamSubmissionSummary;
  /** Phase 12: consent given on Instructions page before starting exam */
  consentGiven?: boolean;
}

const STORAGE_KEY = "hj_exam_session";

const defaultState: ExamSessionState = {
  examId: "",
  email: "",
  currentQuestion: 1,
  selectedAnswers: {},
  flaggedQuestions: [],
};

export function useExamSession() {
  const [state, setState] = useLocalStorageState<ExamSessionState>(STORAGE_KEY, defaultState);

  const update = useCallback(
    (patch: Partial<ExamSessionState>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    [setState]
  );

  const reset = useCallback(() => {
    setState(defaultState);
  }, [setState]);

  /** Call when user selects a different exam so previous attempt state is not reused. */
  const switchExam = useCallback(
    (examId: string) => {
      setState((prev) => ({
        ...prev,
        examId,
        attemptId: undefined,
        currentQuestion: 1,
        selectedAnswers: {},
        flaggedQuestions: [],
        startedAt: undefined,
        lastSavedAt: undefined,
      }));
    },
    [setState]
  );

  return { state, update, reset, switchExam };
}
