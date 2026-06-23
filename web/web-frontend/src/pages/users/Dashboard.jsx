import React from "react";
import Sidebar from "./Sidebar";

const Dashboard = () => {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f3f4f6" }}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#7B1113" }}>
          Welcome to BloomQuest
        </h1>
        <p className="text-gray-500 mb-6">Here's an overview of your account.</p>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600 text-sm">
            This is your dashboard content area. Build out widgets, stats, or
            recent activity here.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;