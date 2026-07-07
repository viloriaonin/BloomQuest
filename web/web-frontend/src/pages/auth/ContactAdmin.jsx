import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/bloomquest-logo.png";

// Connects directly to your local backend server environment
const API_URL = "http://localhost:8000/api/contact-admin";
const CHECK_STATUS_URL = "http://localhost:8000/api/contact-admin/check-status";

const ContactAdmin = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  
  // State management for requests status alerts
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingRequestStatus, setExistingRequestStatus] = useState(null); // 'pending' | 'approved' | 'declined'

  const isValidEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  // Optional: Checks status immediately when user finishes typing the email field
  const handleEmailBlur = async () => {
    if (!email.trim() || !isValidEmail(email)) return;

    try {
      const response = await fetch(`${CHECK_STATUS_URL}?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setExistingRequestStatus(data.status); // e.g., 'pending', 'approved'
          setError(""); 
        } else {
          setExistingRequestStatus(null);
        }
      }
    } catch (err) {
      console.error("Backend status check failed:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Form Validations
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!department.trim()) {
      setError("Department or Section is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Block submission explicitly if an existing ticket is tracked in state
    if (existingRequestStatus === "pending") {
      setError("Cannot submit. You already have a pending request under this email.");
      return;
    }
    if (existingRequestStatus === "approved") {
      setError("This email request has already been approved. Please check your inbox or log in.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          department: department,
          email: email,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle database unique constraint violations caught by backend pipeline
        if (response.status === 409 || data.status) {
          setExistingRequestStatus(data.status || "pending");
          setError(data.detail || "An account request already exists for this email.");
          return;
        }
        setError(data.detail || "Failed to submit your request. Please try again.");
        return;
      }

      setSuccess(true);
      setExistingRequestStatus("pending"); // Set locally to reflect submission state change
      
      // Clear personal fields on successful submission
      setFullName("");
      setDepartment("");
    } catch (err) {
      setError("Unable to connect to the server. Please verify your backend application is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-col md:flex-row flex-1">

        {/* LEFT: Brand Panel (Matches standard auth background styling metrics) */}
        <div
          className="relative w-full md:w-1/2 flex flex-col items-center justify-center py-16 px-8 overflow-hidden"
          style={{
            background: "radial-gradient(circle at 50% 35%, #9c1c1f 0%, #7B1113 55%, #5c0d0f 100%)",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: "640px",
              height: "640px",
              background: "radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.08) 45%, rgba(212,175,55,0) 70%)",
            }}
          />
          <div
            className="absolute rounded-full border"
            style={{
              width: "440px",
              height: "440px",
              borderColor: "rgba(212,175,55,0.2)",
            }}
          />
          <img
            src={logo}
            alt="BloomQuest Logo"
            className="relative w-80 h-80 md:w-96 md:h-96 object-contain drop-shadow-2xl mb-6"
          />
          <h1 className="relative text-4xl font-bold tracking-wide text-white mb-2">
            BloomQuest
          </h1>
          <div className="relative w-16 h-1 rounded-full mb-4" style={{ backgroundColor: "#D4AF37" }} />
          <p className="relative text-base text-center max-w-xs" style={{ color: "#e8c97a" }}>
            Empowering students to grow, learn, and lead.
          </p>
        </div>

        {/* RIGHT: Contact Admin Form Panel */}
        <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-50 py-16 px-6">
          <div className="w-full max-w-sm">

            {/* Back to Login Anchor Link */}
            <div className="mb-6">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/");
                }}
                className="inline-flex items-center gap-1 text-base font-medium transition hover:opacity-80"
                style={{ color: "#7B1113", textDecoration: "none" }}
              >
                <span>‹</span> Back to Login
              </a>
            </div>

            <div className="mb-8">
              <h2 className="text-4xl font-bold" style={{ color: "#7B1113" }}>
                Contact Admin
              </h2>
              <p className="text-base text-gray-500 mt-1">
                Don't have an account? Message your administrator below.
              </p>
            </div>

            {/* ALERT NOTIFICATIONS */}
            {error && (
              <div className="mb-4 text-base text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 text-base text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2.5">
                Your request has been submitted successfully!
              </div>
            )}

            {/* DYNAMIC POSTGRESQL REQUEST STATUS DISPLAY BLOCKS */}
            {existingRequestStatus === "pending" && (
              <div className="mb-4 flex items-center gap-2 border border-amber-200 bg-amber-50 text-amber-800 rounded-md px-4 py-3 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Existing Request Status: <strong className="uppercase">Pending Review</strong>
              </div>
            )}

            {existingRequestStatus === "approved" && (
              <div className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-md px-4 py-3 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                Existing Request Status: <strong className="uppercase">Approved</strong>
              </div>
            )}

            {existingRequestStatus === "declined" && (
              <div className="mb-4 flex items-center gap-2 border border-gray-200 bg-gray-100 text-gray-700 rounded-md px-4 py-3 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-gray-400" />
                Existing Request Status: <strong className="uppercase">Declined</strong>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">
                  Department / Section
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. College of Engineering"
                  className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="Enter your email"
                  className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || existingRequestStatus === "pending" || existingRequestStatus === "approved"}
                className="w-full text-white font-semibold py-3 rounded-md transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#B01C1C" }}
                onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = "#931616")}
                onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = "#B01C1C")}
              >
                {loading ? "Submitting..." : "Submit Account Request"}
              </button>
            </form>

            <p className="text-center text-base text-gray-400 mt-10">
              Need help signing in? Contact the registrar's office.
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        className="w-full py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ backgroundColor: "#5c0d0f" }}
      >
        <p className="text-base" style={{ color: "#D4AF37" }}>
          © 2026 BloomQuest. All rights reserved.
        </p>
        <div className="flex gap-4 text-base" style={{ color: "#D4AF37" }}>
          <a href="#" className="hover:text-white transition">Privacy Policy</a>
          <a href="#" className="hover:text-white transition">Terms of Service</a>
          <a href="#" className="hover:text-white transition">Help Center</a>
        </div>
      </footer>
    </div>
  );
};

export default ContactAdmin;