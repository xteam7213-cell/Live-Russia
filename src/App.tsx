import { AppProvider, useApp } from '@/store/AppContext';
import { AppShell } from '@/components/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CommunityPage } from '@/pages/CommunityPage';
import { StaffPage } from '@/pages/StaffPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { DiscordPage } from '@/pages/DiscordPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { AdminPage } from '@/pages/AdminPage';
import { SuggestionsPage } from '@/pages/SuggestionsPage';
import { SupportPage } from '@/pages/SupportPage';
import { EventsPage } from '@/pages/EventsPage';
import { RadioPage } from '@/pages/RadioPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ComplaintsPage } from '@/pages/ComplaintsPage';
import { LoanOffersPage } from '@/pages/LoanOffersPage';
import { CallsPage } from '@/pages/CallsPage';
import { ChatPage } from '@/pages/ChatPage';
import { RulesPage } from '@/pages/RulesPage';
import { LiveStagePage } from '@/pages/LiveStagePage';
import { hasPermission } from '@/lib/rbac';

function AccessDenied() {
  const { navigate } = useApp();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">Access Denied</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-300">
        Your current role does not have permission to access the Administrator Panel. Direct URL access cannot bypass
        server-side permission checks.
      </p>
      <button onClick={() => navigate('dashboard')} className="btn-gold mt-6 text-xs">
        Return to Dashboard
      </button>
    </div>
  );
}

function Router() {
  const { page, authed, loading, rbacRole, navigate } = useApp();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500" />
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold-400">Loading Portal...</p>
        </div>
      </div>
    );
  }

  if (!authed || page === 'login') {
    return <LoginPage />;
  }

  // RBAC: Block admin page for roles without admin.view permission
  if (page === 'admin' && !hasPermission(rbacRole, 'admin.view')) {
    return <AppShell><AccessDenied /></AppShell>;
  }

  let content;
  switch (page) {
    case 'dashboard':
      content = <DashboardPage />;
      break;
    case 'profile':
      content = <ProfilePage />;
      break;
    case 'community':
      content = <CommunityPage />;
      break;
    case 'staff':
      content = <StaffPage />;
      break;
    case 'activity':
      content = <ActivityPage />;
      break;
    case 'discord':
      content = <DiscordPage />;
      break;
    case 'announcements':
      content = <AnnouncementsPage />;
      break;
    case 'suggestions':
      content = <SuggestionsPage />;
      break;
    case 'support':
      content = <SupportPage />;
      break;
    case 'events':
      content = <EventsPage />;
      break;
    case 'radio':
      content = <RadioPage />;
      break;
    case 'reports':
      content = <ReportsPage />;
      break;
    case 'complaints':
      content = <ComplaintsPage />;
      break;
    case 'loan-offers':
      content = <LoanOffersPage />;
      break;
    case 'calls':
      content = <CallsPage />;
      break;
    case 'chat':
      content = <ChatPage />;
      break;
    case 'rules':
      content = <RulesPage />;
      break;
    case 'live-stage':
      content = <LiveStagePage />;
      break;
    case 'admin':
      content = <AdminPage />;
      break;
    default:
      content = <DashboardPage />;
  }

  return <AppShell>{content}</AppShell>;
}

function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}

export default App;
