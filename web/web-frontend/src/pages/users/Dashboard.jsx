import React from "react";

const Dashboard = () => {
  return (
    // We removed the h-screen and overflow-hidden here!
    <div className="w-full min-h-full p-8" style={{ backgroundColor: "#f3f4f6" }}>
      
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

    </div>
  );
};

export default Dashboard;