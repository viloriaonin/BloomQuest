import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth Pages
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/Forgotpass";
import ContactAdmin from "./pages/auth/ContactAdmin";
import LandingPage from "./pages/LandingPage";

// User Pages
import Dashboard from "./pages/users/Dashboard";
import InputQuestion from "./pages/users/InputQuestion";
import QuestionBank from "./pages/users/QuestionBank";
import History from "./pages/users/History";
import Sidebar from "./pages/users/Sidebar";
import UserWorkspacePage from "./pages/users/UserWorkspacePage";
import UserToolsPage from "./pages/users/UserToolsPage";
import PageContainer from "./components/PageContainer";
import TopBar from "./components/TopBar";

// Admin Pages
import AdminDashboard from "./pages/admin/admindashboard";
// IMPORT YOUR ADMIN QUESTION BANK HERE:
// import AdminQuestionBank from "./pages/admin/QuestionBank"; 

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

const AdminRoute = ({ children }) => {
  const role = getUserRole();
  if (!role) return <Navigate to="/" replace />;
  return role === "admin" ? children : <Navigate to="/dashboard" replace />;
};

const UserRoute = ({ children }) => {
  const role = getUserRole();
  if (!role) return <Navigate to="/" replace />;
  return role === "admin" ? <Navigate to="/admin/dashboard" replace /> : children;
};

const QuestionBankRoute = () => {
  if (getUserRole() === "admin") {
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
      <PageContainer>
        <MainLayout>
          <QuestionBank />
        </MainLayout>
      </PageContainer>
    </UserRoute>
  );
};

const AdminAcademicRoute = () => (
  <AdminRoute>
    <PageContainer>
      <AdminDashboard />
    </PageContainer>
  </AdminRoute>
);

// ---------------------------------------------------------
// Main App Router
// ---------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
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
              <PageContainer>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </PageContainer>
            </UserRoute>
          } 
        />
        <Route 
          path="/input" 
          element={
            <UserRoute>
              <PageContainer>
                <MainLayout>
                  <InputQuestion />
                </MainLayout>
              </PageContainer>
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
              <PageContainer>
                <MainLayout>
                  <History />
                </MainLayout>
              </PageContainer>
            </UserRoute>
          } 
        />
        <Route
          path="/settings"
          element={
            <UserRoute>
              <PageContainer>
                <MainLayout>
                  <UserWorkspacePage section="settings" />
                </MainLayout>
              </PageContainer>
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
                <PageContainer>
                  <MainLayout>
                    <UserToolsPage section={section} />
                  </MainLayout>
                </PageContainer>
              </UserRoute>
            }
          />
        ))}

        {/* ========================================= */}
        {/* ADMIN ROUTES                              */}
        {/* ========================================= */}
        
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
    </BrowserRouter>
  );
}

export default App;