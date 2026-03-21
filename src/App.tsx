import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import AllExamsPage from "./pages/AllExamsPage";
import AuthPage from "./pages/AuthPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import CheckoutPage from "./pages/CheckoutPage";
import SystemCheckPage from "./pages/SystemCheckPage";
import InstructionsPage from "./pages/InstructionsPage";
import LiveExamPage from "./pages/LiveExamPage";
import SuccessPage from "./pages/SuccessPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentResults from "./pages/StudentResults";
import StudentOrdersPage from "./pages/StudentOrdersPage";
import StudentCertificatesPage from "./pages/StudentCertificatesPage";
import StudentNotificationsPage from "./pages/StudentNotificationsPage";
import ProctorDashboard from "./pages/ProctorDashboard";
import WarningStatesDemo from "./pages/WarningStatesDemo";
import NotFound from "./pages/NotFound";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import StatusPage from "./pages/StatusPage";
import OrgDashboardPage from "./pages/OrgDashboardPage";
import AdminLayout from "./pages/admin/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import ExamsPage from "./pages/admin/ExamsPage";
import ExamSetupPage from "./pages/admin/ExamSetupPage";
import ExamCreatePage from "./pages/admin/ExamCreatePage";
import ExamEditPage from "./pages/admin/ExamEditPage";
import ExamDetailPage from "./pages/admin/ExamDetailPage";
import ExamResultsPage from "./pages/admin/ExamResultsPage";
import ExamMonitorPage from "./pages/admin/ExamMonitorPage";
import QuestionBankListPage from "./pages/admin/question-bank/QuestionBankListPage";
import QuestionBankCreatePage from "./pages/admin/question-bank/QuestionBankCreatePage";
import QuestionBankDetailPage from "./pages/admin/question-bank/QuestionBankDetailPage";
import QuestionBankEditPage from "./pages/admin/question-bank/QuestionBankEditPage";
import QuestionBankAnalyticsPage from "./pages/admin/question-bank/QuestionBankAnalyticsPage";
import CandidatesPage from "./pages/admin/CandidatesPage";
import CandidateCreatePage from "./pages/admin/CandidateCreatePage";
import CandidateEditPage from "./pages/admin/CandidateEditPage";
import CandidateActivityPage from "./pages/admin/CandidateActivityPage";
import NotificationsPage from "./pages/admin/NotificationsPage";
import NotificationTemplatesPage from "./pages/admin/NotificationTemplatesPage";
import SettingsPage from "./pages/admin/SettingsPage";
import HelpPage from "./pages/admin/HelpPage";
import HelpCenterPage from "./pages/admin/HelpCenterPage";
import SettingsDetailPage from "./pages/admin/SettingsDetailPage";
import AdminAccountPage from "./pages/admin/AdminAccountPage";
import AdminBillingPage from "./pages/admin/AdminBillingPage";
import PaymentsReconciliationPage from "./pages/admin/PaymentsReconciliationPage";
import CouponsPage from "./pages/admin/CouponsPage";
import SubscriptionPlansPage from "./pages/admin/SubscriptionPlansPage";
import AdminSectionPlaceholderPage from "./pages/admin/AdminSectionPlaceholderPage";
import ReportsPage from "./pages/admin/ReportsPage";
import EvaluatePage from "./pages/admin/EvaluatePage";
import EvidenceAuditLogPage from "./pages/admin/EvidenceAuditLogPage";
import SupportTicketsPage from "./pages/admin/SupportTicketsPage";
import SupportSettingsPage from "./pages/admin/SupportSettingsPage";
import AbuseLogsPage from "./pages/admin/AbuseLogsPage";
import SecurityEventsPage from "./pages/admin/SecurityEventsPage";
import ProctorAssignmentsPage from "./pages/admin/ProctorAssignmentsPage";
import ProctorSchedulingPage from "./pages/admin/ProctorSchedulingPage";
import ProctorIncidentsPage from "./pages/admin/ProctorIncidentsPage";
import WebhookSimulatorPage from "./pages/admin/WebhookSimulatorPage";
import InstitutionsPage from "./pages/admin/InstitutionsPage";
import PoliciesPage from "./pages/admin/PoliciesPage";
import FeatureFlagsPage from "./pages/admin/FeatureFlagsPage";
import RevenuePage from "./pages/admin/RevenuePage";
import ReviewQueuePage from "./pages/admin/ReviewQueuePage";
import AppealsPage from "./pages/admin/AppealsPage";
import CertificatesPage from "./pages/admin/CertificatesPage";
import VerifyCertificatePage from "./pages/VerifyCertificatePage";
import IntegrationsPage from "./pages/admin/IntegrationsPage";
import TeachersPage from "./pages/admin/TeachersPage";
import TeacherCreatePage from "./pages/admin/TeacherCreatePage";
import SiteSettingsPage from "./pages/admin/SiteSettingsPage";
import SitePagesPage from "./pages/admin/SitePagesPage";
import SitePageEditorPage from "./pages/admin/SitePageEditorPage";
import FileVaultPage from "./pages/admin/FileVaultPage";
import RequireRegistration from "./components/RequireRegistration";
import RequireAdminAuth from "./components/RequireAdminAuth";
import RequireProctorAuth from "./components/RequireProctorAuth";
import RedirectByRole from "./components/RedirectByRole";
import SitePageView from "./pages/SitePageView";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { SiteSeoDefaults } from "@/hooks/useSiteSeo";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider>
      <SiteSeoDefaults />
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Student Flow */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/all-exams" element={<AllExamsPage />} />
          <Route path="/pages/contact" element={<ContactPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
          <Route path="/pages/:slug" element={<SitePageView />} />
          <Route path="/dashboard" element={<RedirectByRole />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/checkout"
            element={
              <RequireRegistration>
                <CheckoutPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-dashboard"
            element={
              <RequireRegistration>
                <StudentDashboard />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-profile"
            element={
              <RequireRegistration>
                <StudentProfile />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-results"
            element={
              <RequireRegistration>
                <StudentResults />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-orders"
            element={
              <RequireRegistration>
                <StudentOrdersPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-certificates"
            element={
              <RequireRegistration>
                <StudentCertificatesPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/student-notifications"
            element={
              <RequireRegistration>
                <StudentNotificationsPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/system-check"
            element={
              <RequireRegistration>
                <SystemCheckPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/instructions"
            element={
              <RequireRegistration>
                <InstructionsPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/exam"
            element={
              <RequireRegistration>
                <LiveExamPage />
              </RequireRegistration>
            }
          />
          <Route
            path="/success"
            element={
              <RequireRegistration>
                <SuccessPage />
              </RequireRegistration>
            }
          />
          
          {/* Proctor & Admin */}
          <Route
            path="/proctor"
            element={
              <RequireProctorAuth>
                <ProctorDashboard />
              </RequireProctorAuth>
            }
          />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin Panel */}
          <Route
            element={
              <RequireAdminAuth>
                <AdminLayout />
              </RequireAdminAuth>
            }
          >
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/org" element={<OrgDashboardPage />} />
            <Route path="/admin/account" element={<AdminAccountPage />} />
            <Route path="/admin/billing" element={<AdminBillingPage />} />
            <Route path="/admin/payments-reconciliation" element={<PaymentsReconciliationPage />} />
            <Route path="/admin/coupons" element={<CouponsPage />} />
            <Route path="/admin/revenue" element={<RevenuePage />} />
            <Route path="/admin/review-queue" element={<ReviewQueuePage />} />
            <Route path="/admin/appeals" element={<AppealsPage />} />
            <Route path="/admin/certificates" element={<CertificatesPage />} />
            <Route path="/admin/subscription-plans" element={<SubscriptionPlansPage />} />
            <Route path="/admin/integrations" element={<IntegrationsPage />} />
            <Route path="/admin/site-settings" element={<SiteSettingsPage />} />
            <Route path="/admin/site-pages" element={<SitePagesPage />} />
            <Route path="/admin/site-pages/new" element={<SitePageEditorPage mode="create" />} />
            <Route path="/admin/site-pages/:pageId" element={<SitePageEditorPage mode="edit" />} />
            <Route path="/admin/teachers" element={<TeachersPage />} />
            <Route path="/admin/teachers/new" element={<TeacherCreatePage />} />
            <Route path="/admin/teachers/:id" element={<TeachersPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/notifications/:id" element={<NotificationsPage />} />
            <Route path="/admin/notification-templates" element={<NotificationTemplatesPage />} />
            <Route path="/admin/exams" element={<ExamsPage />} />
            <Route path="/admin/exams/settings" element={<ExamSetupPage />} />
            <Route path="/admin/exams/new" element={<ExamCreatePage />} />
            <Route path="/admin/exams/:examId" element={<ExamDetailPage />} />
            <Route path="/admin/exams/:examId/edit" element={<ExamEditPage />} />
            <Route path="/admin/exams/:examId/results" element={<ExamResultsPage />} />
            <Route path="/admin/exams/:examId/monitor" element={<ExamMonitorPage />} />
            <Route path="/admin/help" element={<HelpCenterPage />} />
            <Route path="/admin/help/articles" element={<HelpCenterPage />} />
            <Route path="/admin/help/articles/new" element={<HelpCenterPage />} />
            <Route path="/admin/help/articles/:id" element={<HelpCenterPage />} />
            <Route path="/admin/help/categories" element={<HelpCenterPage />} />
            <Route path="/admin/help/faqs" element={<HelpCenterPage />} />
            <Route path="/admin/help/videos" element={<HelpCenterPage />} />
            <Route path="/admin/help/settings" element={<HelpCenterPage />} />
            <Route path="/admin/help/feedback" element={<HelpCenterPage />} />
            <Route path="/admin/help-center" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/articles" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/articles/new" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/articles/:id" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/categories" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/faqs" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/videos" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/settings" element={<HelpCenterPage />} />
            <Route path="/admin/help-center/feedback" element={<HelpCenterPage />} />
            <Route path="/admin/section/integrations" element={<Navigate to="/admin/integrations" replace />} />
            <Route path="/admin/section/teachers" element={<Navigate to="/admin/teachers" replace />} />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/exams/settings" element={<ExamSetupPage />} />
            <Route path="/exams/new" element={<ExamCreatePage />} />
            <Route path="/exams/:examId" element={<ExamDetailPage />} />
            <Route path="/exams/:examId/edit" element={<ExamEditPage />} />
            <Route path="/exams/:examId/results" element={<ExamResultsPage />} />
            <Route path="/exams/:examId/monitor" element={<ExamMonitorPage />} />
            <Route path="/notifications" element={<Navigate to="/admin/notifications" replace />} />
            <Route path="/notifications/new" element={<Navigate to="/admin/notifications" replace />} />
            <Route path="/help" element={<Navigate to="/admin/help-center" replace />} />
            <Route path="/admin/evidence-audit" element={<EvidenceAuditLogPage />} />
            <Route path="/admin/file-vault" element={<FileVaultPage />} />
            <Route path="/admin/support-tickets" element={<SupportTicketsPage />} />
            <Route path="/admin/support-settings" element={<SupportSettingsPage />} />
            <Route path="/admin/abuse-logs" element={<AbuseLogsPage />} />
            <Route path="/admin/security-events" element={<SecurityEventsPage />} />
            <Route path="/admin/proctor-assignments" element={<ProctorAssignmentsPage />} />
            <Route path="/admin/proctor-scheduling" element={<ProctorSchedulingPage />} />
            <Route path="/admin/proctor-incidents" element={<ProctorIncidentsPage />} />
            <Route path="/admin/webhook-simulator" element={<WebhookSimulatorPage />} />
            <Route path="/admin/institutions" element={<InstitutionsPage />} />
            <Route path="/admin/policies" element={<PoliciesPage />} />
            <Route path="/admin/feature-flags" element={<FeatureFlagsPage />} />
            <Route path="/admin/section/reports" element={<ReportsPage />} />
            <Route path="/admin/section/evaluate" element={<EvaluatePage />} />
            <Route path="/admin/section/:slug" element={<AdminSectionPlaceholderPage />} />
            <Route path="/admin/question-bank" element={<QuestionBankListPage />} />
            <Route path="/admin/question-bank/new" element={<QuestionBankCreatePage />} />
            <Route path="/admin/question-bank/analytics" element={<QuestionBankAnalyticsPage />} />
            <Route path="/admin/question-bank/:id" element={<QuestionBankDetailPage />} />
            <Route path="/admin/question-bank/:id/edit" element={<QuestionBankEditPage />} />
            <Route path="/questions" element={<Navigate to="/admin/question-bank" replace />} />
            <Route path="/questions/new" element={<Navigate to="/admin/question-bank/new" replace />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/new" element={<CandidateCreatePage />} />
            <Route path="/candidates/:candidateId/edit" element={<CandidateEditPage />} />
            <Route path="/candidates/:candidateId/activity" element={<CandidateActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:slug" element={<SettingsDetailPage />} />
            <Route path="/help/legacy" element={<HelpPage />} />
          </Route>
          
          {/* Demo Pages */}
          <Route path="/warnings" element={<WarningStatesDemo />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;



