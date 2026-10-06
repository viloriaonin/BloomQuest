import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { API_URL } from "./config/api";

// Auth Pages
// User Pages
import Sidebar from "./pages/users/Sidebar";
import PageContainer from "./components/PageContainer";
import TopBar from "./components/TopBar";

// Admin Pages

const Login = React.lazy(() => import("./pages/auth/Login"));
const ForgotPassword = React.lazy(() => import("./pages/auth/Forgotpass"));
const ContactAdmin = React.lazy(() => import("./pages/auth/ContactAdmin"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const Dashboard = React.lazy(() => import("./pages/users/Dashboard"));
const InputQuestion = React.lazy(() => import("./pages/users/InputQuestion"));
const QuestionBank = React.lazy(() => import("./pages/users/QuestionBank"));
const AssessmentAnalytics = React.lazy(() => import("./pages/users/AssessmentAnalytics"));
const History = React.lazy(() => import("./pages/users/History"));
const UserWorkspacePage = React.lazy(() => import("./pages/users/UserWorkspacePage"));
const UserToolsPage = React.lazy(() => import("./pages/users/UserToolsPage"));
const AdminDashboard = React.lazy(() => import("./pages/admin/admindashboard"));
const DepartmentAdminDashboard = React.lazy(() => import("./pages/admin/admindashboard").then((module) => ({ default: module.DepartmentAdminDashboard })));
const SuperAdminDashboard = React.lazy(() => import("./pages/admin/SuperAdminDashboard"));

// ---------------------------------------------------------
// 1. User Layout (Standard Sidebar)
// ---------------------------------------------------------
const MainLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [theme, setTheme] = React.useState(() => localStorage.getItem("bloomquest-theme") || "dark");

  React.useEffect(() => {
    const handleThemeUpdated = (event) => setTheme(event.detail?.theme || localStorage.getItem("bloomquest-theme") || "dark");
    window.addEventListener("theme-updated", handleThemeUpdated);
    return () => window.removeEventListener("theme-updated", handleThemeUpdated);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
    setMobileSidebarOpen(prev => !prev);
  };

  return (
    <div className={`bq-shell bq-user-shell ${theme === "light" ? "bq-user-light" : "bq-user-dark"} flex h-screen w-full overflow-hidden`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onNavigate={() => setMobileSidebarOpen(false)}
        onToggleCollapsed={toggleSidebar}
      />
      <div className="bq-user-main min-w-0 flex-1 h-full overflow-hidden">
        <TopBar onToggleSidebar={toggleSidebar} />
        <div className="bq-user-content h-[calc(100vh-76px)] overflow-y-auto">
          <PageContainer>
            {React.isValidElement(children)
              ? React.cloneElement(children, {
                onToggleSidebar: toggleSidebar,
                theme,
                onThemeChange: (nextTheme) => {
                  localStorage.setItem("bloomquest-theme", nextTheme);
                  setTheme(nextTheme);
                  window.dispatchEvent(new CustomEvent("theme-updated", { detail: { theme: nextTheme } }));
                },
                })
              : children}
          </PageContainer>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// Role-Based Protection
// ---------------------------------------------------------
const getUserRole = () => {
  return localStorage.getItem("role")?.toLowerCase();
};

const ADMIN_ROLES = ["admin", "campus_admin", "department_admin"];

const AdminRoute = ({ children, academicOnly = false }) => {
  const role = getUserRole();
  const [isAuthorized, setIsAuthorized] = React.useState(ADMIN_ROLES.includes(role) ? "checking" : "denied");

  React.useEffect(() => {
    if (!role || role === "super_admin") {
      setIsAuthorized("denied");
      return;
    }

    let cancelled = false;
    fetch(`${API_URL}/admin/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          const backendRole = String(data?.role || "").toLowerCase();
          if (backendRole === "super_admin") {
            setIsAuthorized("super-admin");
            return;
          }
          if (!ADMIN_ROLES.includes(backendRole)) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            setIsAuthorized("denied");
            return;
          }
          localStorage.setItem("role", backendRole);
          setIsAuthorized("allowed");
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          setIsAuthorized("denied");
        }
      });

    return () => { cancelled = true; };
  }, [role]);

  if (!role) return <Navigate to="/" replace />;
  if (role === "super_admin" || isAuthorized === "super-admin") return <Navigate to="/super-admin/dashboard" replace />;
  if (isAuthorized === "checking") return <div className="flex h-screen items-center justify-center text-sm text-slate-500">Checking admin access…</div>;
  if (isAuthorized === "allowed" && role === "department_admin" && !academicOnly) {
    return <Navigate to="/admin/academic" replace />;
  }
  return isAuthorized === "allowed" ? children : <Navigate to="/dashboard" replace />;
};

const SuperAdminRoute = ({ children }) => {
  const role = getUserRole();
  if (!role) return <Navigate to="/" replace />;
  if (role === "super_admin") return children;
  return ["campus_admin", "admin"].includes(role)
    ? <Navigate to="/admin/dashboard" replace />
    : role === "department_admin"
      ? <Navigate to="/admin/academic" replace />
    : <Navigate to="/dashboard" replace />;
};

const UserRoute = ({ children }) => {
  const role = getUserRole();
  if (!role) return <Navigate to="/" replace />;
  if (role === "super_admin") return <Navigate to="/super-admin/dashboard" replace />;
  return ["campus_admin", "admin"].includes(role)
    ? <Navigate to="/admin/dashboard" replace />
    : role === "department_admin"
      ? <Navigate to="/admin/academic" replace />
      : children;
};

const QuestionBankRoute = () => {
  if (["admin", "campus_admin", "department_admin"].includes(getUserRole())) {
    return (
      <AdminRoute>
        <PageContainer>
          <AdminDashboard />
        </PageContainer>
      </AdminRoute>
    );
  }

  return (
    <UserRoute>
      <MainLayout>
        <QuestionBank />
      </MainLayout>
    </UserRoute>
  );
};

const AdminAcademicRoute = () => (
  <AdminRoute academicOnly>
    <PageContainer>
      {getUserRole() === "department_admin"
        ? <DepartmentAdminDashboard />
        : <AdminDashboard />}
    </PageContainer>
  </AdminRoute>
);

// ---------------------------------------------------------
// Main App Router
// ---------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>}>
        <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/contact-admin" element={<ContactAdmin />} />
        
        {/* ========================================= */}
        {/* USER ROUTES                               */}
        {/* ========================================= */}
        <Route 
          path="/dashboard" 
          element={
            <UserRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </UserRoute>
          } 
        />
        <Route 
          path="/input" 
          element={
            <UserRoute>
              <MainLayout>
                <InputQuestion />
              </MainLayout>
            </UserRoute>
          } 
        />
        <Route 
          path="/question-bank" 
          element={<QuestionBankRoute />}
        />
        <Route
          path="/question-bank/:subjectId"
          element={<QuestionBankRoute />}
        />
        <Route
          path="/history"
          element={
            <UserRoute>
              <MainLayout>
                <History />
              </MainLayout>
            </UserRoute>
          } 
        />
        <Route
          path="/analytics"
          element={
            <UserRoute>
              <MainLayout>
                <AssessmentAnalytics />
              </MainLayout>
            </UserRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <UserRoute>
              <MainLayout>
                <UserWorkspacePage section="settings" />
              </MainLayout>
            </UserRoute>
          }
        />
        {[
          ["/assessments", "assessments"],
          ["/favorites", "favorites"],
          ["/subjects", "subjects"],
          ["/notifications", "notifications"],
          ["/imports", "imports"],
          ["/recycle-bin", "recycle"],
          ["/system-status", "status"],
          ["/help", "help"],
        ].map(([path, section]) => (
          <Route
            key={path}
            path={path}
            element={
              <UserRoute>
                <MainLayout>
                  <UserToolsPage section={section} />
                </MainLayout>
              </UserRoute>
            }
          />
        ))}

        {/* ========================================= */}
        {/* ADMIN ROUTES                              */}
        {/* ========================================= */}

        <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
        <Route path="/super-admin/academic" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        <Route path="/super-admin/academic/campus/:campusId" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        <Route path="/super-admin/academic/campus/:campusId/department/:departmentId" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        <Route path="/super-admin/academic/campus/:campusId/department/:departmentId/program/:programId" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        <Route path="/super-admin/questions" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        <Route path="/super-admin/*" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
        
        {/* Redirect base /admin to the admin dashboard */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <PageContainer>
                <AdminDashboard />
              </PageContainer>
            </AdminRoute>
          } 
        />
        <Route path="/admin/academic" element={<AdminAcademicRoute />} />
        <Route path="/admin/academic/campus/:campusId" element={<AdminAcademicRoute />} />
        <Route path="/admin/academic/campus/:campusId/department/:departmentId" element={<AdminAcademicRoute />} />
        <Route path="/admin/academic/campus/:campusId/department/:departmentId/program/:programId" element={<AdminAcademicRoute />} />
        <Route path="/admin/questions" element={<AdminAcademicRoute />} />
        <Route path="/admin/questions/:subjectId" element={<AdminAcademicRoute />} />
        <Route path="/admin/users" element={<AdminAcademicRoute />} />

        <Route
          path="/admin/users/:userId"
          element={
            <AdminRoute>
              <PageContainer>
                <AdminDashboard />
              </PageContainer>
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;