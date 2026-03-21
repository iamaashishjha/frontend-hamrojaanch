import { get, post } from "@/lib/apiClient";

export interface CertificateItem {
  id: string;
  attemptId: string;
  examId: string;
  verificationCode: string;
  issuedAt: string;
  attempt?: { exam?: { id: string; title: string }; user?: { email: string; name: string } };
}

export interface VerifyResult {
  valid: boolean;
  verificationCode?: string;
  examTitle?: string;
  candidateName?: string;
  issuedAt?: string;
}

export async function listCertificates(): Promise<CertificateItem[]> {
  const { items } = await get<{ items: CertificateItem[] }>("/admin/certificates");
  return items;
}

export async function issueCertificate(attemptId: string): Promise<{ certificate: CertificateItem }> {
  return post("/admin/certificates", { attemptId });
}

export async function verifyCertificate(code: string): Promise<VerifyResult> {
  return get("/public/certificates/verify", { code });
}
