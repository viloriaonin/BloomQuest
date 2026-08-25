import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePopup } from "../../components/PopupProvider";
import LoadingSpinner from "../../components/LoadingSpinner";
import LegalModal from "../../components/LegalModal";

const SEND_OTP_URL    = "http://localhost:8000/api/forgot-password/send-otp";
const VERIFY_OTP_URL  = "http://localhost:8000/api/forgot-password/verify-otp";
const RESET_PASS_URL  = "http://localhost:8000/api/forgot-password/reset";

const paper = '#F7F6F3';
const surface = '#FFFFFF';
const border = 'rgba(20, 20, 15, 0.14)';
const ruleSoft = 'rgba(20, 20, 15, 0.08)';
const textPrimary = '#14140F';
const textMuted = '#6F6C64';
const accent = '#B4454A';
const accentHover = '#8F1C2B';

// ── Password strength helper ───────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: "", color: "#E5E7EB" };
  let score = 0;
  if (pw.length >= 8)               score++;
  if (/[A-Z]/.test(pw))             score++;
  if (/[0-9]/.test(pw))             score++;
  if (/[^A-Za-z0-9]/.test(pw))     score++;
  const map = [
    { label: "Too short",  color: "#EF4444" },
    { label: "Weak",       color: "#F97316" },
    { label: "Fair",       color: "#EAB308" },
    { label: "Good",       color: "#22C55E" },
    { label: "Strong",     color: "#15803D" },
  ];
  return { score, ...map[score] };
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { showAlert } = usePopup();

  // steps: "email" | "otp" | "reset" | "done"
  const [step, setStep]         = useState("email");
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [legalModal, setLegalModal] = useState(null); // "privacy" | "terms" | null

  const otpRefs = useRef([]);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const strength = getStrength(password);

  const getErrorMessage = (payload) => {
    if (!payload) return "Something went wrong. Please try again.";

    if (typeof payload === "string") return payload;

    if (Array.isArray(payload)) {
      const parts = payload.map(getErrorMessage).filter(Boolean);
      return parts.join(" ");
    }

    if (typeof payload === "object") {
      if (typeof payload.detail === "string") return payload.detail;
      if (typeof payload.message === "string") return payload.message;
      if (Array.isArray(payload.detail)) return getErrorMessage(payload.detail);
      if (payload.detail && typeof payload.detail === "object") {
        if (typeof payload.detail.msg === "string") return payload.detail.msg;
        if (typeof payload.detail.error === "string") return payload.detail.error;
      }
      if (typeof payload.error === "string") return payload.error;
      return JSON.stringify(payload);
    }

    return String(payload);
  };

  // ── Step 1: Email → send OTP ───────────────────────────────────
  const handleEmailSubmit = async () => {
    setError("");
    if (!email.trim())        { setError("Email address is required."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address (e.g. name@example.com)."); return; }

    setLoading(true);
    try {
      const response = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(getErrorMessage(data) || "Unable to send reset code. Please check the email and try again.");
        return;
      }

      setDemoCode(data.demo_code || "");
      setStep("otp");
    } catch {
      setError("Unable to connect to the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────
  const handleOtpSubmit = async (autoCode) => {
    setError("");
    // Use the passed code if provided (from auto-submit), otherwise join the array
    const code = typeof autoCode === "string" ? autoCode : otp.join("");
    
    if (code.length < 6) { setError("Please enter the full 6-digit code."); return; }

    setLoading(true);
    try {
      const response = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(getErrorMessage(data) || "Incorrect code. Please try again.");
        // Clear the OTP fields so the user can type again
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }

      setStep("reset");
    } catch {
      setError("Unable to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset password ─────────────────────────────────────
  const handleResetSubmit = async () => {
    setError("");
    if (!password)                   { setError("New password is required."); return; }
    if (password.length < 8)         { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password))      { setError("Password must include at least one uppercase letter."); return; }
    if (!/[0-9]/.test(password))      { setError("Password must include at least one number."); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError("Password must include at least one symbol."); return; }
    if (password !== confirm)        { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch(RESET_PASS_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.join(""), new_password: password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(getErrorMessage(data) || "Failed to reset password. Please try again.");
        return;
      }

      setStep("done");
    } catch {
      setError("Unable to connect to the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input helpers ──────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    } 
    
    // Auto-submit when the 6th box is filled
    if (value && index === 5) {
      const fullCode = next.join("");
      if (fullCode.length === 6) {
        handleOtpSubmit(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      otpRefs.current[index - 1]?.focus();
    if (e.key === "Enter") handleOtpSubmit();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otp];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    
    // Auto-submit if exactly 6 digits were pasted
    if (pasted.length === 6) {
        handleOtpSubmit(pasted);
    }
  };

  const resendOtp = async () => {
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(getErrorMessage(data) || "Unable to resend code. Please try again.");
        return;
      }
      showAlert("A new verification code has been sent to your email.");
    } catch {
      setError("Unable to resend code. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared UI ──────────────────────────────────────────────────
  const BackButton = ({ label = "Back", onClick }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 transition"
      style={{ color: accent, fontFamily: 'Inter, sans-serif' }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );

  const PrimaryButton = ({ onClick, disabled, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-white font-semibold py-3.5 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ backgroundColor: accent, fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '13px' }}
      onMouseOver={(e) => !disabled && (e.currentTarget.style.backgroundColor = accentHover)}
      onMouseOut={(e) => !disabled && (e.currentTarget.style.backgroundColor = accent)}
    >
      {children}
    </button>
  );

  const ErrorBox = ({ msg }) =>
    msg ? (
      <div className="mb-4 text-sm px-4 py-2.5" style={{ color: '#8E2B33', backgroundColor: 'rgba(180, 69, 74, 0.06)', border: '1px solid rgba(180,69,74,0.25)', fontFamily: 'Inter, sans-serif' }}>
        {msg}
      </div>
    ) : null;

  const EyeIcon = ({ open }) => open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

  // ── Step renderers ─────────────────────────────────────────────
  const renderEmail = () => (
    <>
      <BackButton label="Back to Login" onClick={() => navigate("/")} />
      <div className="mb-8">
        <h2 className="bq-headline text-4xl" style={{ color: textPrimary }}>Forgot password?</h2>
        <div style={{ width: '36px', height: '2px', backgroundColor: accent, marginTop: '14px', marginBottom: '14px' }} />
        <p className="text-base" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
          Enter your email and we'll send you a one-time code.
        </p>
      </div>

      <ErrorBox msg={error} />

      <div className="space-y-6">
        <div>
          <label className="bq-label block mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
            placeholder="name@example.com"
            className="bq-field"
          />
        </div>
        <PrimaryButton onClick={handleEmailSubmit} disabled={loading}>
          {loading ? "Sending code..." : "Send Code"}
        </PrimaryButton>
      </div>
    </>
  );

  const renderOtp = () => (
    <>
      <BackButton
        label="Change email"
        onClick={() => { setStep("email"); setError(""); setOtp(["", "", "", "", "", ""]); }}
      />
      <div className="mb-6">
        <h2 className="bq-headline text-4xl" style={{ color: textPrimary }}>Check your email</h2>
        <div style={{ width: '36px', height: '2px', backgroundColor: accent, marginTop: '14px', marginBottom: '14px' }} />
        <p className="text-base" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
          We sent a 6-digit code to <span style={{ color: textPrimary, fontWeight: 600 }}>{email}</span>
        </p>
      </div>

      <ErrorBox msg={error} />

      {demoCode ? (
        <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(180,69,74,0.04)', border: `1px solid ${border}`, fontFamily: 'Inter, sans-serif' }}>
          <p className="font-semibold" style={{ color: textPrimary }}>Demo Mode — OTP not actually sent via email</p>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>
            Use the demo code below to continue, or paste your real email code if it arrives.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center rounded-lg px-3 py-2 text-lg font-semibold tracking-widest" style={{ backgroundColor: surface, color: accent, border: `1px solid ${border}` }}>
              {demoCode}
            </div>
            <button
              type="button"
              onClick={() => {
                setOtp(demoCode.split(""));
                otpRefs.current[0]?.focus();
              }}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Auto-fill
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 mb-5 justify-between" onPaste={handleOtpPaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (otpRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(i, e)}
            className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:outline-none transition"
            style={{
              borderColor: digit ? accent : "#D1D5DB",
              color: textPrimary,
              caretColor: accent,
              fontFamily: 'Inter, sans-serif',
            }}
            onFocus={(e) => (e.target.style.borderColor = accent)}
            onBlur={(e) => (e.target.style.borderColor = digit ? accent : "#D1D5DB")}
          />
        ))}
      </div>

      <PrimaryButton onClick={() => handleOtpSubmit(otp.join(""))} disabled={loading}>
        {loading ? <LoadingSpinner label="Verifying..." spinnerColor="border-white" /> : "Verify Code"}
      </PrimaryButton>

      <button
        onClick={resendOtp}
        disabled={loading}
        className="w-full mt-3 text-sm font-medium py-2 transition"
        style={{ color: accent, fontFamily: 'Inter, sans-serif' }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Resend code
      </button>
    </>
  );

  const renderReset = () => (
    <>
      <div className="mb-8">
        <h2 className="bq-headline text-4xl" style={{ color: textPrimary }}>Reset your password</h2>
        <div style={{ width: '36px', height: '2px', backgroundColor: accent, marginTop: '14px', marginBottom: '14px' }} />
        <p className="text-base" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
          Choose a strong password for your account.
        </p>
      </div>

      <ErrorBox msg={error} />

      <div className="space-y-6">
        <div>
          <label className="bq-label block mb-2">New Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetSubmit()}
              placeholder="Enter new password"
              className="bq-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-0 top-1/2 -translate-y-1/2 transition"
              style={{ color: textMuted }}
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>

          {password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="flex-1 h-1 rounded-full transition-all duration-300"
                    style={{ background: strength.score >= n ? strength.color : "#E5E7EB" }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strength.color, fontFamily: 'Inter, sans-serif' }}>
                {strength.label}
              </p>
            </div>
          )}
          <p className="text-xs mt-1.5" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
            At least 8 characters with uppercase, numbers, and symbols.
          </p>
        </div>

        <div>
          <label className="bq-label block mb-2">Confirm Password</label>
          <div className="relative">
            <input
              type={showCf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetSubmit()}
              placeholder="Re-enter new password"
              className="bq-field pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCf(!showCf)}
              className="absolute right-0 top-1/2 -translate-y-1/2 transition"
              style={{ color: textMuted }}
              tabIndex={-1}
            >
              <EyeIcon open={showCf} />
            </button>
          </div>
          {confirm && password && confirm !== password && (
            <p className="text-xs mt-1" style={{ color: '#B4454A', fontFamily: 'Inter, sans-serif' }}>Passwords do not match.</p>
          )}
          {confirm && password && confirm === password && (
            <p className="text-xs mt-1" style={{ color: '#15803D', fontFamily: 'Inter, sans-serif' }}>✓ Passwords match.</p>
          )}
        </div>

        <PrimaryButton onClick={handleResetSubmit} disabled={loading}>
          {loading ? <LoadingSpinner label="Updating password..." spinnerColor="border-white" /> : "Update Password"}
        </PrimaryButton>
      </div>
    </>
  );

  const renderDone = () => (
    <div className="text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ background: "rgba(34,197,94,0.1)" }}
      >
        <svg className="w-8 h-8" fill="none" stroke="#15803D" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="bq-headline text-4xl mb-3" style={{ color: textPrimary }}>Password updated!</h2>
      <p className="text-base mb-6" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
        Your password has been successfully changed. You can now sign in with your new password.
      </p>

      <button
        onClick={() => navigate("/")}
        className="w-full text-white font-semibold py-3.5 transition duration-200"
        style={{ backgroundColor: accent, fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '13px' }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = accentHover)}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = accent)}
      >
        Back to Login
      </button>
    </div>
  );

  // ── Progress indicator ─────────────────────────────────────────
  const STEPS = ["email", "otp", "reset"];
  const currentIndex = STEPS.indexOf(step);
  const STEP_LABELS = ["Email", "Code", "New Password"];

  return (
    <div className="min-h-screen flex flex-col page-transition relative" style={{ minHeight: '100vh', overflow: 'hidden', backgroundColor: paper }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
        .bq-card-shell {
          position: relative;
          background: ${surface};
          border: 1px solid ${border};
          border-radius: 28px;
          box-shadow: 0 18px 48px rgba(20, 20, 15, 0.08);
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
        .bq-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${textMuted};
        }
        .bq-headline {
          font-family: 'Fraunces', serif;
          font-weight: 500;
          letter-spacing: -0.02em;
        }
        .bq-field {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid ${border};
          border-radius: 0;
          padding: 10px 2px;
          font-size: 16px;
          color: ${textPrimary};
          font-family: 'Inter', sans-serif;
          transition: border-color 0.2s ease;
        }
        .bq-field::placeholder { color: #A6A39A; }
        .bq-field:focus { outline: none; border-bottom-color: ${accent}; }
      `}</style>

      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(135deg, #F1F0EC 0%, #EEF2F8 100%)` }} />
      <div className="absolute -top-20 -right-20 rounded-full opacity-20" style={{ width: 420, height: 420, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
      <div className="absolute -bottom-28 -left-24 rounded-full opacity-15" style={{ width: 500, height: 500, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />

      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="bq-card-shell w-full max-w-md p-8 md:p-10">
          <span className="bq-corner bq-corner-tl" />
          <span className="bq-corner bq-corner-tr" />
          <span className="bq-corner bq-corner-bl" />
          <span className="bq-corner bq-corner-br" />

          {step !== "done" && (
            <div className="flex items-center gap-2 mb-8">
              {STEP_LABELS.map((label, i) => (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: i <= currentIndex ? accent : "rgba(180,69,74,0.12)",
                        color: i <= currentIndex ? "#fff" : textPrimary,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {i < currentIndex ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="text-xs font-medium" style={{ color: i <= currentIndex ? textPrimary : textMuted, fontFamily: 'Inter, sans-serif' }}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className="flex-1 h-px transition-all" style={{ background: i < currentIndex ? accent : '#D9D4CD', minWidth: '12px' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {step === "email" && renderEmail()}
          {step === "otp" && renderOtp()}
          {step === "reset" && renderReset()}
          {step === "done" && renderDone()}
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

export default ForgotPassword;