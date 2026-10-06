import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import LegalModal from "../../components/LegalModal";
import PublicNav from "../../components/PublicNav";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";

import { API_URL } from "../../config/api";

const SEND_OTP_URL = `${API_URL}/contact-admin/send-otp`;
const VERIFY_OTP_URL = `${API_URL}/contact-admin/verify-otp`;
const CHECK_STATUS_URL = `${API_URL}/contact-admin/check-status`;

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

  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [campusId, setCampusId] = useState("");
  const [campuses, setCampuses] = useState([]);
  const [campusesLoading, setCampusesLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [programId, setProgramId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  
  // State management for requests status alerts
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "privacy" | "terms" | null
  const [existingRequestStatus, setExistingRequestStatus] = useState(null); // 'pending' | 'approved' | 'declined' | 'existing'
  const [pendingSubmission, setPendingSubmission] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
        fetch(`${API_URL}/campuses`),
        fetch(`${API_URL}/departments`), 
    ])
      .then(async ([campusResponse, departmentResponse]) => {
        if (!campusResponse.ok || !departmentResponse.ok) {
          throw new Error("Failed to load campus and department options");
        }
        return Promise.all([campusResponse.json(), departmentResponse.json()]);
      })
      .then(([campusData, departmentData]) => {
        if (!active) return;
        setCampuses(Array.isArray(campusData) ? campusData : []);
        setDepartments(Array.isArray(departmentData) ? departmentData : []);
      })
      .catch(() => {
        if (active) {
          setCampuses([]);
          setDepartments([]);
        }
      })
      .finally(() => {
        if (active) setCampusesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const campusDepartments = departments.filter((item) => Number(item.campus_id) === Number(campusId));
  const selectedDepartment = campusDepartments.find((item) => item.name === department);
  const availablePrograms = selectedDepartment?.programs || [];
  const fullName = [firstName.trim(), middleInitial.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");

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
          const status = data.status || "existing";
          setExistingRequestStatus(status);
          setError(status === "declined"
            ? "Your previous request was declined. You may submit a new request."
            : "This email is already in use or has an existing request.");
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
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!campusId) {
      setError("Please select your campus.");
      return;
    }
    if (!department.trim()) {
      setError("Department or Section is required.");
      return;
    }
    if (!programId) {
      setError("Program is required.");
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
    if (otpSent && otp.trim().length !== 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    // Block submission explicitly if ANY existing ticket/account is tracked in state
    if (existingRequestStatus && existingRequestStatus !== "declined") {
      setError("Cannot submit. This email is already in use or requested.");
      return;
    }

    setLoading(true);
    try {
      const payloadEmail = sanitizeEmail(email);
      setEmail(payloadEmail);

      const response = await fetch(otpSent ? VERIFY_OTP_URL : SEND_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: otpSent
          ? JSON.stringify({ email: payloadEmail, otp: otp.trim() })
          : JSON.stringify({
              full_name: fullName,
              campus_id: Number(campusId),
              department,
              program_id: Number(programId),
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

      if (!otpSent) {
        setDemoOtp(typeof data.demo_otp === "string" && /^\d{6}$/.test(data.demo_otp) ? data.demo_otp : "");
        setOtpSent(true);
        setError("");
        return;
      }

      setSuccess(true);
      setExistingRequestStatus("pending"); // Set locally to reflect submission state change
      setPendingSubmission({
        firstName,
        middleInitial,
        lastName,
        department,
        program: availablePrograms.find((program) => String(program.id) === String(programId))?.name || "N/A",
        email: payloadEmail,
      });
      
      // Clear personal fields on successful submission
      setFirstName("");
      setMiddleInitial("");
      setLastName("");
      setCampusId("");
      setDepartment("");
      setOtp("");
      setOtpSent(false);
      setDemoOtp("");
      setProgramId("");
    } catch (err) {
      setError("Unable to connect to the server. Please verify your backend application is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bq-login-page min-h-screen flex flex-col page-transition relative overflow-x-hidden pt-24 sm:pt-28"
      style={{ minHeight: '100vh', backgroundColor: paper }}
    >
      <PublicNav />
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
        .bq-contact-center { overflow: visible; }
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
          .bq-contact-page .bq-contact-center { padding-top: 6.75rem; }
          .bq-contact-page .bq-contact-card { margin-top: 0; margin-bottom: 0; }
          .bq-contact-page .bq-contact-form > :not([hidden]) ~ :not([hidden]) { margin-top: 0.8rem; }
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
            .bq-contact-page .bq-contact-center { padding-top: 6rem; padding-bottom: 1rem; }
            .bq-contact-layout { grid-template-columns: 1fr; gap: 0.75rem; max-width: 28rem; }
            .bq-contact-brand { flex-direction: row; align-items: center; justify-content: center; gap: 0.75rem; text-align: left; }
            .bq-contact-brand-copy { display: none; }
          }

        @media (max-height: 760px) {
          .bq-contact-page .bq-contact-center { padding-top: 7.5rem; padding-bottom: 1rem; overflow-y: auto; }
          .bq-contact-brand-mark { width: min(100%, 18rem); }
          .bq-contact-card { padding: 1rem 1.5rem; }
          .bq-contact-card-header { margin-bottom: 1rem; }
          .bq-contact-card-title { font-size: 2.25rem; }
          .bq-contact-form > :not([hidden]) ~ :not([hidden]) { margin-top: 0.55rem; }
          .bq-contact-card .bq-field { padding-top: 0.55rem; padding-bottom: 0.55rem; }
          .bq-contact-footer { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        }

        @media (max-height: 600px) {
          .bq-contact-page .bq-contact-center { padding-top: 7rem; overflow-y: auto; align-items: flex-start; }
          .bq-contact-brand-mark { width: min(100%, 15rem); }
          .bq-contact-card { padding: 0.75rem 1.25rem; }
          .bq-contact-card-header { margin-bottom: 0.75rem; }
          .bq-contact-card-title { font-size: 2rem; }
          .bq-contact-form { gap: 0.5rem; }
          .bq-contact-footer { font-size: 0.6875rem; }
        }
      `}</style>

      <div className="bq-login-backdrop pointer-events-none absolute inset-0 -z-10" />

      {/* Centered Contact Admin Card */}
      <div className="bq-login-center min-h-0 flex-1 flex items-center justify-center overflow-visible px-4 py-6 sm:py-8">
        <div className="bq-contact-layout">
          <div className="bq-contact-brand flex flex-col items-start gap-4 text-left">
            <img src={bloomquestLogo} alt="BloomQuest" className="bq-contact-brand-mark" />
            <div className="bq-contact-brand-copy">
              <p className="bq-eyebrow">Request access</p>
              <p className="mt-3 max-w-xs text-sm leading-6" style={{ color: textMuted }}><TypewriterText>Connect your faculty account to the assessment workspace.</TypewriterText></p>
            </div>
          </div>
          <div
          className="bq-login-card bq-contact-card bq-card w-full max-w-md shrink-0 p-5 sm:p-6 md:p-8"
          style={{ backgroundColor: surface, border: `1px solid ${rule}` }}
        >
          <span className="bq-corner bq-corner-tl" />
          <span className="bq-corner bq-corner-tr" />
          <span className="bq-corner bq-corner-bl" />
          <span className="bq-corner bq-corner-br" />

          <div className="bq-login-card-header bq-contact-card-header mb-5 sm:mb-6">
            <h2 className="bq-login-card-title bq-contact-card-title bq-headline text-3xl sm:text-4xl" style={{ color: ink }}>
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

          {otpSent && (
            <div className={`mb-4 border px-4 py-3 text-sm ${demoOtp ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#D9E1EC] bg-[#F5F8FC]"}`} style={{ color: demoOtp ? undefined : textMuted, fontFamily: 'Inter, sans-serif' }}>
              {demoOtp ? (
                <>
                  <p className="font-semibold">Demo Verification Code: <span className="font-mono text-lg tracking-widest">{demoOtp}</span></p>
                  <p className="mt-1">Demo Mode — use this code to continue verification.</p>
                </>
              ) : (
                <p>A six-digit verification code was sent to your email. Check your inbox and spam folder, then enter it below to submit your request.</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bq-contact-form bq-login-fields space-y-4 sm:space-y-5">
            {!otpSent && <>
            <div className="grid gap-4 sm:grid-cols-[1.35fr_0.65fr_1.35fr] sm:gap-5">
              <div>
                <label className="bq-label block mb-2">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="bq-field"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="bq-label block mb-2">M.I.</label>
                <input
                  type="text"
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase())}
                  placeholder="M.I."
                  className="bq-field"
                  maxLength={1}
                  autoComplete="additional-name"
                />
              </div>
              <div>
                <label className="bq-label block mb-2">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="bq-field"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className="bq-label block mb-2">Campus</label>
              <select
                value={campusId}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setDepartment("");
                  setProgramId("");
                }}
                className="bq-field"
                required
                disabled={campusesLoading || otpSent}
              >
                <option value="">{campusesLoading ? "Loading campuses..." : "Select your campus"}</option>
                {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}{campus.code ? ` (${campus.code})` : ""}</option>)}
              </select>
              {!campusesLoading && !campuses.length && <p className="mt-1 text-xs text-red-700">No active campuses are available. Please contact your administrator.</p>}
            </div>

            <div>
              <label className="bq-label block mb-2">
                Department / Section
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setProgramId("");
                }}
                className="bq-field"
                required
                disabled={!campusId || otpSent}
              >
                <option value="">{campusId ? "Select your department" : "Select a campus first"}</option>
                {campusDepartments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>

            <div>
              <label className="bq-label block mb-2">Program</label>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="bq-field" required disabled={!department || !availablePrograms.length || otpSent}>
                <option value="">{department ? (availablePrograms.length ? "Select your program" : "No programs available") : "Select a department first"}</option>
                {availablePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}{program.code ? ` (${program.code})` : ""}</option>)}
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
                  setOtpSent(false);
                  setOtp("");
                }}
                onBlur={handleEmailBlur}
                placeholder="name@example.com"
                className="bq-field"
              />
            </div>
            </>}

            {otpSent && (
              <div>

              {pendingSubmission && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14140F]/45 px-4 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-2xl border border-[#D9E1EC] bg-white p-6 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="request-pending-title">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">!</span>
                      <div>
                        <p className="bq-label">Request submitted</p>
                        <h2 id="request-pending-title" className="mt-1 text-2xl font-semibold text-[#14140F]">Your request is pending</h2>
                        <p className="mt-2 text-sm leading-6 text-[#6F6C64]">Your information has been sent to the administrator for review.</p>
                      </div>
                    </div>
                    <div className="mt-6 divide-y divide-[#E7E5E0] border-y border-[#E7E5E0]">
                      {[["First name", pendingSubmission.firstName], ["Middle initial", pendingSubmission.middleInitial || "N/A"], ["Last name", pendingSubmission.lastName], ["Department / Section", pendingSubmission.department], ["Program", pendingSubmission.program], ["Email address", pendingSubmission.email]].map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <span className="bq-label">{label}</span>
                          <span className="text-sm font-medium text-[#14140F] sm:text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setPendingSubmission(null)} className="mt-6 w-full bg-[#14140F] py-3 text-sm font-semibold text-white transition hover:bg-[#B4454A]">Done</button>
                  </div>
                </div>
              )}
                <label className="bq-label block mb-2">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="bq-field"
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                  className="mt-2 text-xs font-semibold hover:underline"
                  style={{ color: accent }}
                >
                  Use a different email or request a new code
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!!existingRequestStatus && existingRequestStatus !== "declined")}
              className="w-full text-white font-semibold py-3 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: ink }}
              onMouseOver={(e) => !loading && (!existingRequestStatus || existingRequestStatus === "declined") && (e.currentTarget.style.backgroundColor = accent)}
              onMouseOut={(e) => !loading && (!existingRequestStatus || existingRequestStatus === "declined") && (e.currentTarget.style.backgroundColor = ink)}
            >
              {loading ? <LoadingSpinner label={otpSent ? "Verifying..." : "Sending code..."} spinnerColor="border-white" /> : otpSent ? "Verify & Submit Request" : "Send Verification Code"}
            </button>
          </form>

          <div className="flex items-center gap-3 pt-1">
            <hr className="flex-1" style={{ borderColor: ruleSoft }} />
            <span className="bq-label">Or</span>
            <hr className="flex-1" style={{ borderColor: ruleSoft }} />
          </div>

          <p className="text-center text-sm" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
            Back to login? <button type="button" onClick={() => navigate("/login")} className="font-semibold hover:underline" style={{ color: accent }}>Sign in here</button>
          </p>
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
      </footer>

      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </div>
  );
};

export default ContactAdmin;