import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/users/Dashboard";
import AdminDashboard from "./pages/admin/admindashboard";
import InputQuestion from "./pages/users/InputQuestion";
import Sidebar from "./pages/users/Sidebar";
import QuestionBank from "./pages/users/QuestionBank";
import History from "./pages/users/History";

const MainLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 w-full">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

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
  return role === "admin" ? <Navigate to="/admin" replace /> : children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
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
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;