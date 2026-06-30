import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/bloomquest-logo.png";

const SEND_OTP_URL    = "http://localhost:8000/api/forgot-password/send-otp";
const VERIFY_OTP_URL  = "http://localhost:8000/api/forgot-password/verify-otp";
const RESET_PASS_URL  = "http://localhost:8000/api/forgot-password/reset";

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

  // Demo-only OTP
  const [demoOtp, setDemoOtp]           = useState("");
  const [showDemoPanel, setShowDemoPanel] = useState(true);

  const otpRefs = useRef([]);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const strength = getStrength(password);

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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Unable to send reset code. Please check the email and try again.");
        return;
      }

      const data = await response.json().catch(() => ({}));
      const generated = data.otp || String(Math.floor(100000 + Math.random() * 900000));
      setDemoOtp(generated);
      setShowDemoPanel(true);
      setStep("otp");
    } catch {
      setError("Unable to connect to the server. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────
  const handleOtpSubmit = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the full 6-digit code."); return; }

    // Demo: check against generated code
    if (code !== demoOtp) {
      setError("Incorrect code. Check the demo panel and try again.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Verification failed. Please try again.");
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
    if (strength.score < 2)          { setError("Password is too weak. Add uppercase letters, numbers, or symbols."); return; }
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
        setError(data.detail || data.message || "Failed to reset password. Please try again.");
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
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
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
        setError(data.detail || "Unable to resend code. Please try again.");
        return;
      }
      setDemoOtp(data.otp || String(Math.floor(100000 + Math.random() * 900000)));
      setShowDemoPanel(true);
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
      className="flex items-center gap-1.5 text-sm font-medium mb-8 transition"
      style={{ color: "#7B1113" }}
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
      className="w-full text-white font-semibold py-3 rounded-md transition duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ backgroundColor: "#B01C1C" }}
      onMouseOver={(e) => !disabled && (e.currentTarget.style.backgroundColor = "#931616")}
      onMouseOut={(e) => !disabled && (e.currentTarget.style.backgroundColor = "#B01C1C")}
    >
      {children}
    </button>
  );

  const ErrorBox = ({ msg }) =>
    msg ? (
      <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
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

  // ── Demo OTP Panel ─────────────────────────────────────────────
  const DemoPanel = () =>
    demoOtp && showDemoPanel ? (
      <div
        className="mb-6 rounded-lg border px-4 py-3 flex items-start gap-3"
        style={{ background: "rgba(212,175,55,0.07)", borderColor: "rgba(212,175,55,0.4)" }}
      >
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="#B8860B" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5" style={{ color: "#7a5c00" }}>
            Demo Mode — OTP not actually sent via email
          </p>
          <p className="text-xs text-gray-500 mb-2">
            In production this code is emailed to{" "}
            <span className="font-medium">{email}</span>. Use the code below to test:
          </p>
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-bold"
              style={{ color: "#7B1113", letterSpacing: "0.25em" }}
            >
              {demoOtp}
            </span>
            <button
              onClick={() => {
                const digits = demoOtp.split("");
                setOtp(digits);
                setTimeout(() => otpRefs.current[5]?.focus(), 50);
              }}
              className="text-xs px-2 py-1 rounded border font-medium transition"
              style={{ color: "#7B1113", borderColor: "rgba(123,17,19,0.3)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(123,17,19,0.05)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Auto-fill
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowDemoPanel(false)}
          className="text-gray-400 hover:text-gray-600 transition flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ) : null;

  // ── Step renderers ─────────────────────────────────────────────
  const renderEmail = () => (
    <>
      <BackButton label="Back to Login" onClick={() => navigate("/login")} />
      <div className="mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ background: "rgba(123,17,19,0.08)" }}
        >
          <svg className="w-6 h-6" fill="none" stroke="#7B1113" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold" style={{ color: "#7B1113" }}>Forgot password?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter your email and we'll send you a one-time code.
        </p>
      </div>

      <ErrorBox msg={error} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
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
        onClick={() => { setStep("email"); setError(""); setOtp(["", "", "", "", "", ""]); setDemoOtp(""); }}
      />
      <div className="mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ background: "rgba(123,17,19,0.08)" }}
        >
          <svg className="w-6 h-6" fill="none" stroke="#7B1113" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold" style={{ color: "#7B1113" }}>Check your email</h2>
        <p className="text-sm text-gray-500 mt-1">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-gray-700">{email}</span>
        </p>
      </div>

      <DemoPanel />
      <ErrorBox msg={error} />

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
              borderColor: digit ? "#7B1113" : "#D1D5DB",
              color: "#1A0A0A",
              caretColor: "#7B1113",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#7B1113")}
            onBlur={(e) => (e.target.style.borderColor = digit ? "#7B1113" : "#D1D5DB")}
          />
        ))}
      </div>

      <PrimaryButton onClick={handleOtpSubmit} disabled={loading}>
        {loading ? "Verifying..." : "Verify Code"}
      </PrimaryButton>

      <button
        onClick={resendOtp}
        disabled={loading}
        className="w-full mt-3 text-sm font-medium py-2 transition"
        style={{ color: "#7B1113" }}
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
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{ background: "rgba(123,17,19,0.08)" }}
        >
          <svg className="w-6 h-6" fill="none" stroke="#7B1113" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold" style={{ color: "#7B1113" }}>Set new password</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a strong password for your account.
        </p>
      </div>

      <ErrorBox msg={error} />

      <div className="space-y-4">
        {/* New password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetSubmit()}
              placeholder="Enter new password"
              className="w-full border border-gray-300 rounded-md px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>

          {/* Strength bar */}
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="flex-1 h-1 rounded-full transition-all duration-300"
                    style={{
                      background: strength.score >= n ? strength.color : "#E5E7EB",
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            At least 8 characters with uppercase, numbers, or symbols.
          </p>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showCf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetSubmit()}
              placeholder="Re-enter new password"
              className="w-full border border-gray-300 rounded-md px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowCf(!showCf)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              tabIndex={-1}
            >
              <EyeIcon open={showCf} />
            </button>
          </div>
          {confirm && password && confirm !== password && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
          )}
          {confirm && password && confirm === password && (
            <p className="text-xs text-green-600 mt-1">✓ Passwords match.</p>
          )}
        </div>

        <PrimaryButton onClick={handleResetSubmit} disabled={loading}>
          {loading ? "Updating password..." : "Update Password"}
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
      <h2 className="text-2xl font-bold mb-2" style={{ color: "#7B1113" }}>Password updated!</h2>
      <p className="text-sm text-gray-500 mb-6">
        Your password has been successfully changed. You can now sign in with your new password.
      </p>

      <button
        onClick={() => navigate("/login")}
        className="w-full text-white font-semibold py-3 rounded-md transition duration-200 shadow-md hover:shadow-lg"
        style={{ backgroundColor: "#B01C1C" }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#931616")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#B01C1C")}
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
    <div className="min-h-screen flex flex-col">
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
            style={{ width: "440px", height: "440px", borderColor: "rgba(212,175,55,0.2)" }}
          />
          <img
            src={logo}
            alt="BloomQuest Logo"
            className="relative w-80 h-80 md:w-96 md:h-96 object-contain drop-shadow-2xl mb-6"
          />
          <h1 className="relative text-4xl font-bold tracking-wide text-white mb-2">BloomQuest</h1>
          <div className="relative w-16 h-1 rounded-full mb-4" style={{ backgroundColor: "#D4AF37" }} />
          <p className="relative text-sm text-center max-w-xs" style={{ color: "#e8c97a" }}>
            Empowering students to grow, learn, and lead.
          </p>
        </div>

        {/* RIGHT: Panel */}
        <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-50 py-16 px-6">
          <div className="w-full max-w-sm">

            {/* Step progress — hidden on done */}
            {step !== "done" && (
              <div className="flex items-center gap-2 mb-8">
                {STEP_LABELS.map((label, i) => (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                        style={{
                          background: i <= currentIndex ? "#7B1113" : "rgba(123,17,19,0.12)",
                          color: i <= currentIndex ? "#fff" : "#7B1113",
                        }}
                      >
                        {i < currentIndex ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: i <= currentIndex ? "#7B1113" : "#9CA3AF" }}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div
                        className="flex-1 h-px transition-all"
                        style={{ background: i < currentIndex ? "#7B1113" : "#E5E7EB" }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {step === "email" && renderEmail()}
            {step === "otp"   && renderOtp()}
            {step === "reset" && renderReset()}
            {step === "done"  && renderDone()}

            <p className="text-center text-xs text-gray-400 mt-10">
              Need help signing in? Contact the Registrar's Office.
            </p>
          </div>
        </div>
      </div>

      <footer
        className="w-full py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ backgroundColor: "#5c0d0f" }}
      >
        <p className="text-xs" style={{ color: "#D4AF37" }}>© 2026 BloomQuest. All rights reserved.</p>
        <div className="flex gap-4 text-xs" style={{ color: "#D4AF37" }}>
          <a href="#" className="hover:text-white transition">Privacy Policy</a>
          <a href="#" className="hover:text-white transition">Terms of Service</a>
          <a href="#" className="hover:text-white transition">Help Center</a>
        </div>
      </footer>
    </div>
  );
};

export default ForgotPassword;