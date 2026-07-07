import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth Pages
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/Forgotpass";
import ContactAdmin from "./pages/auth/ContactAdmin";

// User Pages
import Dashboard from "./pages/users/Dashboard";
import InputQuestion from "./pages/users/InputQuestion";
import QuestionBank from "./pages/users/QuestionBank";
import History from "./pages/users/History";
import Sidebar from "./pages/users/Sidebar";

// Admin Pages
import AdminDashboard from "./pages/admin/admindashboard";
import AdminSidebar from "./pages/admin/adminSidebar"; // <-- Make sure this path is correct!
// IMPORT YOUR ADMIN QUESTION BANK HERE:
// import AdminQuestionBank from "./pages/admin/QuestionBank"; 

// ---------------------------------------------------------
// 1. User Layout (Standard Sidebar)
// ---------------------------------------------------------
const MainLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 w-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. NEW: Admin Layout (Admin Sidebar)
// ---------------------------------------------------------
const AdminLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 w-full overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 h-full overflow-y-auto">
        {children}
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

// ---------------------------------------------------------
// Main App Router
// ---------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
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
          element={
            <UserRoute>
              <MainLayout>
                <QuestionBank />
              </MainLayout>
            </UserRoute>
          } 
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

        {/* ========================================= */}
        {/* ADMIN ROUTES                              */}
        {/* ========================================= */}
        
        {/* Redirect base /admin to the admin dashboard */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } 
        />

        {/* NEW: Admin Question Bank Route */}
        <Route 
          path="/admin/questions" 
          element={
            <AdminRoute>
              <AdminLayout>
                {/* Use your actual Admin Question Bank component here */}
                <QuestionBank /> 
              </AdminLayout>
            </AdminRoute>
          } 
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;