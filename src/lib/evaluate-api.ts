import { get } from "@/lib/apiClient";

export interface EvaluateDashboard {
  reviewQueue: {
    pending: number;
    inReview: number;
    resolved: number;
    resolvedToday: number;
  };
  underReviewAttempts: number;
  proctorFlaggedCount: number;
  reviewQueueItems: ReviewQueueItem[];
  underReviewList: UnderReviewAttempt[];
  proctorFlaggedList: ProctorFlaggedAttempt[];
}

export interface ReviewQueueItem {
  id: string;
  attemptId: string;
  status: string;
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  attempt: {
    id: string;
    exam: { id: string; title: string } | null;
    user: { id: string; email: string; name: string } | null;
    email: string;
  } | null;
  assignedTo: { id: string; email: string; name: string } | null;
}

export interface UnderReviewAttempt {
  id: string;
  email: string;
  candidateName: string;
  submittedAt: string | null;
  exam: { id: string; title: string } | null;
}

export interface ProctorFlaggedAttempt {
  id: string;
  email: string;
  candidateName: string;
  submittedAt: string | null;
  exam: { id: string; title: string } | null;
  eventCount: number;
}

export async function getEvaluateDashboard(): Promise<EvaluateDashboard> {
  return get<EvaluateDashboard>("/admin/evaluate/dashboard");
}
