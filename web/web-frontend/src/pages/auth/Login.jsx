import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import LegalModal from "../../components/LegalModal";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";
const API_URL = "http://localhost:8000/api/login";

const paper = '#F7F6F3';
const surface = '#FFFFFF';
const ink = '#14140F';
const rule = 'rgba(20, 20, 15, 0.14)';
const ruleSoft = 'rgba(20, 20, 15, 0.08)';
const textMuted = '#6F6C64';
const accent = '#B4454A';
const accentHover = '#8F1C2B';

const TypewriterText = ({ children, className = "" }) => {
  const [text, setText] = useState("");

  useEffect(() => {
    const fullText = String(children);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(fullText);
      return undefined;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setText(fullText.slice(0, index));
      if (index >= fullText.length) window.clearInterval(timer);
    }, 32);

    return () => window.clearInterval(timer);
  }, [children]);

  return <span className={`bq-typewriter ${className}`}>{text}</span>;
};

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
      localStorage.setItem("user_id", String(data.user_id));
      localStorage.setItem("department", data.department || "");
      window.dispatchEvent(new Event("profile-updated"));

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
    <div className="h-screen flex flex-col page-transition relative overflow-hidden" style={{ height: '100vh', backgroundColor: paper }}>
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
        .bq-brand-mark {
          width: min(100%, 22rem);
          height: auto;
          filter: drop-shadow(0 12px 18px rgba(20, 20, 15, 0.16));
          animation: bq-auth-float 5s ease-in-out 700ms infinite;
        }
        .bq-login-backdrop {
          background-image: linear-gradient(rgba(180, 69, 74, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(180, 69, 74, 0.09) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: linear-gradient(to bottom, black, transparent 72%);
          animation: bq-grid-wave 9s ease-in-out infinite;
        }
        .bq-login-card {
          box-shadow: 0 24px 60px rgba(20, 20, 15, 0.09), 0 3px 12px rgba(20, 20, 15, 0.04);
          border-radius: 12px;
          animation: bq-auth-rise 520ms ease-out both;
        }
        .bq-auth-layout {
          display: grid;
          grid-template-columns: minmax(180px, 0.72fr) minmax(0, 28rem);
          align-items: center;
          gap: clamp(2rem, 6vw, 6rem);
          width: min(100%, 70rem);
        }
        .bq-auth-brand {
          animation: bq-auth-brand-in 620ms 80ms ease-out both;
        }
        .bq-typewriter::after {
          content: "|";
          margin-left: 2px;
          color: ${accent};
          animation: bq-caret-blink 800ms steps(1, end) infinite;
        }
        @keyframes bq-auth-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bq-auth-brand-in {
          from { opacity: 0; transform: translateX(-18px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes bq-caret-blink {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }
        @keyframes bq-grid-wave {
          0%, 100% { background-position: 0 0, 0 0; background-size: 44px 44px; opacity: 0.86; }
          50% { background-position: 18px 10px, 10px 18px; background-size: 48px 48px; opacity: 1; }
        }
        @keyframes bq-auth-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bq-auth-brand, .bq-login-card, .bq-brand-mark, .bq-login-backdrop { animation: none; }
        }
        @media (max-width: 768px) {
          .bq-auth-layout { grid-template-columns: 1fr; gap: 0.75rem; max-width: 28rem; }
          .bq-auth-brand { display: flex; align-items: center; justify-content: center; gap: 0.75rem; text-align: left; }
          .bq-auth-brand-copy { display: none; }
        }

        @media (max-height: 760px) {
          .bq-login-eyebrow { padding-top: 0.5rem; padding-bottom: 0; }
          .bq-brand-mark { width: min(100%, 18rem); }
          .bq-login-center { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          .bq-login-card { padding: 1rem 1.5rem; }
          .bq-login-card-header { margin-bottom: 1rem; }
          .bq-login-card-title { font-size: 2.25rem; }
          .bq-login-fields { gap: 0.75rem; }
          .bq-login-field-label { margin-bottom: 0.25rem; }
          .bq-login-card .bq-field { padding-top: 0.55rem; padding-bottom: 0.55rem; }
          .bq-login-footer { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        }

        @media (max-height: 600px) {
          .bq-login-center { overflow-y: auto; align-items: flex-start; }
          .bq-brand-mark { width: min(100%, 15rem); }
          .bq-login-card { padding: 0.75rem 1.25rem; }
          .bq-login-card-header { margin-bottom: 0.75rem; }
          .bq-login-card-title { font-size: 2rem; }
          .bq-login-fields { gap: 0.5rem; }
          .bq-login-footer { font-size: 0.6875rem; }
        }
      `}</style>

      <div className="bq-login-backdrop pointer-events-none absolute inset-0 -z-10" />

      {/* Centered Login Card */}
      <div className="bq-login-center min-h-0 flex-1 flex items-center justify-center overflow-hidden px-4 py-4 sm:py-6">
        <div className="bq-auth-layout">
          <div className="bq-auth-brand flex flex-col items-start gap-4 text-left">
            <img src={bloomquestLogo} alt="BloomQuest" className="bq-brand-mark" />
            <div className="bq-auth-brand-copy">
              <p className="bq-eyebrow">Workspace access</p>
              <p className="mt-3 max-w-xs text-sm leading-6" style={{ color: textMuted }}><TypewriterText>A focused workspace for building thoughtful, measurable assessments.</TypewriterText></p>
            </div>
          </div>
          <div
          className="bq-login-card bq-card w-full max-w-md shrink-0 p-5 sm:p-6 md:p-8"
          style={{ backgroundColor: surface, border: `1px solid ${rule}` }}
        >
          <span className="bq-corner bq-corner-tl" />
          <span className="bq-corner bq-corner-tr" />
          <span className="bq-corner bq-corner-bl" />
          <span className="bq-corner bq-corner-br" />

          <div className="bq-login-card-header mb-5 sm:mb-6">
            <h2 className="bq-login-card-title bq-headline text-3xl sm:text-4xl" style={{ color: ink }}>
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

          <div className="bq-login-fields space-y-4 sm:space-y-5">

            <div>
              <label className="bq-login-field-label bq-label block mb-2">
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
              <label className="bq-login-field-label bq-label block mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your password"
                  className="bq-field pr-20"
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bq-label"
                    style={{ color: accent, letterSpacing: '0.08em' }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                )}
              </div>
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
      </div>

      <footer
        className="bq-login-footer w-full shrink-0 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
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