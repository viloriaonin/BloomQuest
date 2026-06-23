import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/users/Dashboard";
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route 
          path="/dashboard" 
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          } 
        />
        
      
        <Route 
          path="/input" 
          element={
            <MainLayout>
               <InputQuestion />
            </MainLayout>
          } 
        />

        <Route 
  path="/question-bank" 
  element={
    <MainLayout>
       <QuestionBank />
    </MainLayout>
  } 
/>

       <Route 
          path="/history" 
          element={
            <MainLayout>
              <History />
            </MainLayout>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;