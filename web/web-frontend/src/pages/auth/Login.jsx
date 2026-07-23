import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/bloomquest-logo.png";
import LoadingSpinner from "../../components/LoadingSpinner";
<<<<<<< HEAD
import LegalModal from "../../components/LegalModal";
=======

>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
const API_URL = "http://localhost:8000/api/login";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "privacy" | "terms" | null

  const isValidEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleLogin = async () => {
    setError("");

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Invalid email or password.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("email", data.email);

      const destination = data.role?.toLowerCase() === "admin" ? "/admin" : "/dashboard";
      navigate(destination);
    } catch (err) {
      setError("Unable to connect to the server. Make sure your backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <div className="flex flex-col md:flex-row flex-1">

        {/* LEFT: Brand Panel */}
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

        {/* RIGHT: Login Panel */}
        <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-50 py-16 px-6">
          <div className="w-full max-w-sm">

            <div className="mb-8">
              <h2 className="text-4xl font-bold" style={{ color: "#7B1113" }}>
                Welcome back
              </h2>
            </div>

            {error && (
              <div className="mb-4 text-base text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
                {error}
              </div>
            )}

            <div className="space-y-4">

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your email"
                  className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-base text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-base font-semibold text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-base">
                <label className="flex items-center gap-2 text-gray-600 text-base">
                  <input type="checkbox" className="accent-red-800" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="hover:underline text-base font-medium transition"
                  style={{ color: "#B01C1C" }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className={`w-full text-white font-semibold py-3 rounded-md transition duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${loading ? 'button-loading' : ''}`}
                style={{ backgroundColor: "#B01C1C" }}
                onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = "#931616")}
                onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = "#B01C1C")}
              >
                {loading ? <LoadingSpinner label="Signing in..." spinnerColor="border-white" /> : "Login"}
              </button>

              <div className="flex items-center gap-3 pt-2">
                <hr className="flex-1 border-gray-200" />
                <span className="text-base text-gray-400">OR</span>
                <hr className="flex-1 border-gray-200" />
              </div>

              <p className="text-center text-base text-gray-500">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/contact-admin")}
                  className="font-bold hover:underline"
                  style={{ color: "#B01C1C" }}
                >
                  Contact your administrator
                </button>
              </p>

            </div>

          </div>
        </div>
      </div>

      <footer
        className="w-full py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ backgroundColor: "#5c0d0f" }}
      >
        <p className="text-base" style={{ color: "#D4AF37" }}>
          © 2026 BloomQuest. All rights reserved.
        </p>
        <div className="flex gap-4 text-base" style={{ color: "#D4AF37" }}>
<<<<<<< HEAD
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className="hover:text-white transition"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setLegalModal("terms")}
            className="hover:text-white transition"
          >
            Terms of Service
          </button>
=======
          <a href="#" className="hover:text-white transition">Privacy Policy</a>
          <a href="#" className="hover:text-white transition">Terms of Service</a>
          <a href="#" className="hover:text-white transition">Help Center</a>
>>>>>>> bf6f81e2c462bcdce888dcb27596bea9ff218843
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};

export default Login;