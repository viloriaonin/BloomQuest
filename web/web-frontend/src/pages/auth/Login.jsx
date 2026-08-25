import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import LegalModal from "../../components/LegalModal";
const API_URL = "http://localhost:8000/api/login";

const paper = '#F7F6F3';
const surface = '#FFFFFF';
const ink = '#14140F';
const rule = 'rgba(20, 20, 15, 0.14)';
const ruleSoft = 'rgba(20, 20, 15, 0.08)';
const textMuted = '#6F6C64';
const accent = '#B4454A';
const accentHover = '#8F1C2B';

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
    <div className="min-h-screen flex flex-col page-transition relative" style={{ minHeight: '100vh', overflow: 'hidden', backgroundColor: paper }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');

        .bq-eyebrow {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${accent};
        }
        .bq-headline {
          font-family: 'Fraunces', serif;
          font-optical-sizing: auto;
          font-weight: 500;
          letter-spacing: -0.01em;
        }
        .bq-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${textMuted};
        }
        .bq-field {
          font-family: 'Inter', sans-serif;
          background: transparent;
          border: none;
          border-bottom: 1px solid ${rule};
          border-radius: 0;
          padding: 10px 2px;
          font-size: 15px;
          color: ${ink};
          width: 100%;
          transition: border-color 0.2s ease;
        }
        .bq-field::placeholder { color: #A6A39A; }
        .bq-field:focus {
          outline: none;
          border-bottom: 1.5px solid ${accent};
        }
        .bq-card {
          position: relative;
        }
        .bq-corner {
          position: absolute;
          width: 22px;
          height: 22px;
          border-color: ${accent};
        }
        .bq-corner-tl { top: -10px; left: -10px; border-top: 1.5px solid; border-left: 1.5px solid; }
        .bq-corner-tr { top: -10px; right: -10px; border-top: 1.5px solid; border-right: 1.5px solid; }
        .bq-corner-bl { bottom: -10px; left: -10px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
        .bq-corner-br { bottom: -10px; right: -10px; border-bottom: 1.5px solid; border-right: 1.5px solid; }
        .bq-btn {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 3px;
        }
        .bq-link {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }
      `}</style>

      {/* Quiet eyebrow, top of page */}
      <div className="w-full flex justify-center pt-10 pb-2">
        <span className="bq-eyebrow">BloomQuest &nbsp;·&nbsp; Workspace Access</span>
      </div>

      {/* Centered Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div
          className="bq-card w-full max-w-md p-8 md:p-10"
          style={{ backgroundColor: surface, border: `1px solid ${rule}` }}
        >
          <span className="bq-corner bq-corner-tl" />
          <span className="bq-corner bq-corner-tr" />
          <span className="bq-corner bq-corner-bl" />
          <span className="bq-corner bq-corner-br" />

          <div className="mb-8">
            <h2 className="bq-headline text-4xl" style={{ color: ink }}>
              Welcome back
            </h2>
            <div style={{ width: '36px', height: '2px', backgroundColor: accent, marginTop: '14px', marginBottom: '14px' }} />
            <p className="text-base" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
              Sign in to continue to your BloomQuest workspace.
            </p>
          </div>

          {error && (
            <div
              className="mb-4 text-sm px-4 py-2.5"
              style={{ color: accentHover, backgroundColor: 'rgba(180, 69, 74, 0.06)', border: `1px solid rgba(180, 69, 74, 0.25)`, fontFamily: 'Inter, sans-serif' }}
            >
              {error}
            </div>
          )}

          <div className="space-y-6">

            <div>
              <label className="bq-label block mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="name@example.com"
                className="bq-field"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="bq-label">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="bq-label"
                  style={{ color: accent, letterSpacing: '0.08em' }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
                className="bq-field"
              />
            </div>

            <div className="flex items-center justify-between text-sm pt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              <label className="flex items-center gap-2" style={{ color: textMuted }}>
                <input type="checkbox" style={{ accentColor: accent }} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="bq-link hover:underline"
                style={{ color: accent }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className={`bq-btn w-full text-white py-3.5 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${loading ? 'button-loading' : ''}`}
              style={{ backgroundColor: ink }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = accent)}
              onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = ink)}
            >
              {loading ? <LoadingSpinner label="Signing in..." spinnerColor="border-white" /> : "Log In"}
            </button>

            <div className="flex items-center gap-3 pt-1">
              <hr className="flex-1" style={{ borderColor: ruleSoft }} />
              <span className="bq-label">Or</span>
              <hr className="flex-1" style={{ borderColor: ruleSoft }} />
            </div>

            <p className="text-center text-sm" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/contact-admin")}
                className="font-semibold hover:underline"
                style={{ color: accent }}
              >
                Contact your administrator
              </button>
            </p>

          </div>

        </div>
      </div>

      <footer
        className="w-full py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ backgroundColor: paper, borderTop: `1px solid ${ruleSoft}`, fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-xs" style={{ color: textMuted }}>
          © 2026 BloomQuest. All rights reserved.
        </p>
        <div className="flex gap-4 text-xs" style={{ color: textMuted }}>
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className="hover:opacity-70 transition"
            style={{ color: textMuted }}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setLegalModal("terms")}
            className="hover:opacity-70 transition"
            style={{ color: textMuted }}
          >
            Terms of Service
          </button>
        </div>
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};

export default Login;