import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import LegalModal from "../../components/LegalModal";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";

// Connects directly to your local backend server environment
const API_URL = "http://localhost:8000/api/contact-admin";
const CHECK_STATUS_URL = "http://localhost:8000/api/contact-admin/check-status";

const paper = '#F7F6F3';
const surface = '#FFFFFF';
const ink = '#14140F';
const rule = 'rgba(20, 20, 15, 0.14)';
const ruleSoft = 'rgba(20, 20, 15, 0.08)';
const textMuted = '#6F6C64';
const accent = '#B4454A';
const accentHover = '#8F1C2B';

const TypewriterText = ({ children }) => {
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

  return <span className="bq-typewriter">{text}</span>;
};

const ContactAdmin = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [email, setEmail] = useState("");
  
  // State management for requests status alerts
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "privacy" | "terms" | null
  const [existingRequestStatus, setExistingRequestStatus] = useState(null); // 'pending' | 'approved' | 'declined' | 'existing'

  useEffect(() => {
    let active = true;
    fetch("http://localhost:8000/api/departments")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load departments")))
      .then((data) => {
        if (active) setDepartments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setDepartments([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const isValidEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const sanitizeEmail = (value) => {
    if (!value) return value;
    let v = value.trim();
    if (v.includes("@")) {
      const [local, ...rest] = v.split("@");
      let domain = rest.join("@");
      // common typos: commas or semicolons used instead of dots
      domain = domain.replace(/[,;\s]+/g, ".");
      v = `${local}@${domain}`;
    }
    return v;
  };

  // Checks status immediately when user finishes typing the email field
  const handleEmailBlur = async () => {
    if (!email.trim()) return;

    const sanitized = sanitizeEmail(email);
    if (sanitized !== email) {
      setEmail(sanitized);
      setError("We corrected a small typo in your email address.");
      setTimeout(() => setError(""), 4000);
    }

    if (!isValidEmail(sanitized)) return;

    try {
      const response = await fetch(`${CHECK_STATUS_URL}?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setExistingRequestStatus(data.status || "existing"); // Catches any existing record
          setError("This email is already in use or has an existing request."); 
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

    // Block submission explicitly if ANY existing ticket/account is tracked in state
    if (existingRequestStatus) {
      setError("Cannot submit. This email is already in use or requested.");
      return;
    }

    setLoading(true);
    try {
      // sanitize before submitting
      const payloadEmail = sanitizeEmail(email);
      setEmail(payloadEmail);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          department: department,
          email: payloadEmail,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle database unique constraint violations caught by backend pipeline
        if (response.status === 409 || data.status) {
          setExistingRequestStatus(data.status || "existing");
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

        @media (max-height: 760px) {
          .bq-contact-eyebrow { padding-top: 0.5rem; padding-bottom: 0; }
          .bq-contact-center { padding-top: 0.25rem; padding-bottom: 0.25rem; }
          .bq-contact-card { padding: 1rem 1.5rem; }
          .bq-contact-card-header { margin-bottom: 1rem; }
          .bq-contact-card-title { font-size: 2.25rem; }
          .bq-contact-form { gap: 0.75rem; }
          .bq-contact-card .bq-field { padding-top: 0.55rem; padding-bottom: 0.55rem; }
          .bq-contact-footer { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        }

          .bq-contact-card {
            box-shadow: 0 24px 60px rgba(20, 20, 15, 0.09), 0 3px 12px rgba(20, 20, 15, 0.04);
            border-radius: 12px;
            animation: bq-contact-rise 520ms ease-out both;
          }
          .bq-contact-backdrop {
            background-image: linear-gradient(rgba(180, 69, 74, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(180, 69, 74, 0.09) 1px, transparent 1px);
            background-size: 44px 44px;
            mask-image: linear-gradient(to bottom, black, transparent 72%);
            animation: bq-contact-grid-wave 9s ease-in-out infinite;
          }
          .bq-contact-layout {
            display: grid;
            grid-template-columns: minmax(180px, 0.72fr) minmax(0, 28rem);
            align-items: center;
            gap: clamp(2rem, 6vw, 6rem);
            width: min(100%, 70rem);
          }
          .bq-contact-brand { animation: bq-contact-brand-in 620ms 80ms ease-out both; }
          .bq-typewriter::after { content: "|"; margin-left: 2px; color: ${accent}; animation: bq-contact-caret-blink 800ms steps(1, end) infinite; }
          .bq-contact-brand-mark {
            width: min(100%, 22rem);
            height: auto;
            filter: drop-shadow(0 12px 18px rgba(20, 20, 15, 0.16));
            animation: bq-contact-float 5s ease-in-out 700ms infinite;
          }
          @keyframes bq-contact-rise {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bq-contact-brand-in {
            from { opacity: 0; transform: translateX(-18px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes bq-contact-caret-blink {
            0%, 45% { opacity: 1; }
            46%, 100% { opacity: 0; }
          }
          @keyframes bq-contact-grid-wave {
            0%, 100% { background-position: 0 0, 0 0; background-size: 44px 44px; opacity: 0.86; }
            50% { background-position: 18px 10px, 10px 18px; background-size: 48px 48px; opacity: 1; }
          }
          @keyframes bq-contact-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .bq-contact-brand, .bq-contact-card, .bq-contact-brand-mark, .bq-contact-backdrop { animation: none; }
          }
          @media (max-width: 768px) {
            .bq-contact-layout { grid-template-columns: 1fr; gap: 0.75rem; max-width: 28rem; }
            .bq-contact-brand { flex-direction: row; align-items: center; justify-content: center; gap: 0.75rem; text-align: left; }
            .bq-contact-brand-copy { display: none; }
          }

        @media (max-height: 760px) {
          .bq-contact-brand-mark { width: min(100%, 18rem); }
        }

        @media (max-height: 600px) {
          .bq-contact-center { overflow-y: auto; align-items: flex-start; }
          .bq-contact-brand-mark { width: min(100%, 15rem); }
          .bq-contact-card { padding: 0.75rem 1.25rem; }
          .bq-contact-card-header { margin-bottom: 0.75rem; }
          .bq-contact-card-title { font-size: 2rem; }
          .bq-contact-form { gap: 0.5rem; }
          .bq-contact-footer { font-size: 0.6875rem; }
        }
      `}</style>

      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(135deg, ${paper} 0%, #EEF2F8 100%)` }} />
      <div className="bq-contact-backdrop pointer-events-none absolute inset-0 -z-10" />
      <div className="absolute -top-20 -right-20 rounded-full opacity-20" style={{ width: 420, height: 420, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
      <div className="absolute -bottom-28 -left-24 rounded-full opacity-15" style={{ width: 500, height: 500, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />

      {/* Centered Contact Admin Card */}
      <div className="bq-contact-center min-h-0 flex-1 flex items-center justify-center overflow-hidden px-4 py-4 sm:py-6">
        <div className="bq-contact-layout">
          <div className="bq-contact-brand flex flex-col items-start gap-4 text-left">
            <img src={bloomquestLogo} alt="BloomQuest" className="bq-contact-brand-mark" />
            <div className="bq-contact-brand-copy">
              <p className="bq-eyebrow">Request access</p>
              <p className="mt-3 max-w-xs text-sm leading-6" style={{ color: textMuted }}><TypewriterText>Connect your faculty account to the assessment workspace.</TypewriterText></p>
            </div>
          </div>
          <div
          className="bq-contact-card bq-card my-2 w-full max-w-md shrink-0 p-5 sm:p-6 md:p-8"
          style={{ backgroundColor: surface, border: `1px solid ${rule}` }}
        >
          <span className="bq-corner bq-corner-tl" />
          <span className="bq-corner bq-corner-tr" />
          <span className="bq-corner bq-corner-bl" />
          <span className="bq-corner bq-corner-br" />

          <div className="bq-contact-card-header mb-5 sm:mb-6">
            <h2 className="bq-contact-card-title bq-headline text-3xl sm:text-4xl" style={{ color: ink }}>
              Contact Admin
            </h2>
            <div style={{ width: '36px', height: '2px', backgroundColor: accent, marginTop: '14px', marginBottom: '14px' }} />
            <p className="text-base" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
              Don't have an account? Message your administrator below.
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

          {success && (
            <div
              className="mb-4 text-sm px-4 py-2.5"
              style={{ color: '#15803D', backgroundColor: 'rgba(34, 197, 94, 0.06)', border: `1px solid rgba(34, 197, 94, 0.25)`, fontFamily: 'Inter, sans-serif' }}
            >
              Your request has been submitted successfully!
            </div>
          )}

          {existingRequestStatus === "pending" && (
            <div className="mb-4 flex items-center gap-2 border border-amber-200 bg-amber-50 text-amber-800 rounded-md px-4 py-3 text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Existing Request Status: <strong className="uppercase">Pending Review</strong>
            </div>
          )}

          {existingRequestStatus === "approved" && (
            <div className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-md px-4 py-3 text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              Existing Request Status: <strong className="uppercase">Approved</strong>
            </div>
          )}

          {existingRequestStatus === "declined" && (
            <div className="mb-4 flex items-center gap-2 border border-gray-200 bg-gray-100 text-gray-700 rounded-md px-4 py-3 text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span className="flex h-2 w-2 rounded-full bg-gray-400" />
              Existing Request Status: <strong className="uppercase">Declined</strong>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bq-contact-form space-y-4 sm:space-y-5">
            <div>
              <label className="bq-label block mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="bq-field"
              />
            </div>

            <div>
              <label className="bq-label block mb-2">
                Department / Section
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="bq-field"
                required
              >
                <option value="">Select your department</option>
                {departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>

            <div>
              <label className="bq-label block mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setExistingRequestStatus(null);
                  setError("");
                }}
                onBlur={handleEmailBlur}
                placeholder="name@example.com"
                className="bq-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!existingRequestStatus}
              className="w-full text-white font-semibold py-3 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: ink }}
              onMouseOver={(e) => !loading && !existingRequestStatus && (e.currentTarget.style.backgroundColor = accent)}
              onMouseOut={(e) => !loading && !existingRequestStatus && (e.currentTarget.style.backgroundColor = ink)}
            >
              {loading ? <LoadingSpinner label="Submitting..." spinnerColor="border-white" /> : "Submit Account Request"}
            </button>
          </form>

          <div className="flex items-center gap-3 pt-1">
            <hr className="flex-1" style={{ borderColor: ruleSoft }} />
            <span className="bq-label">Or</span>
            <hr className="flex-1" style={{ borderColor: ruleSoft }} />
          </div>

          <p className="text-center text-sm" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
            Back to login? <button type="button" onClick={() => navigate("/")} className="font-semibold hover:underline" style={{ color: accent }}>Sign in here</button>
          </p>
          </div>
        </div>
      </div>

      <footer
        className="bq-contact-footer w-full shrink-0 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
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

export default ContactAdmin;