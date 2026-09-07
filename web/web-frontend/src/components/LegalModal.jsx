import React, { useEffect, useRef, useState } from "react";
import bloomquestLogo from "../assets/images/bloomquest-logo.png";

const accent = '#B4454A';
const ink = '#17171A';
const textMuted = '#6F6C64';

const privacyContent = (
  <>
    <p className="mb-4"><strong style={{ color: ink }}>1. Overview</strong><br />
    BloomQuest is an educational platform that helps instructors classify questions according to Bloom&apos;s Taxonomy and build assessments. This policy explains what information we collect, how we use it, and how we protect it.</p>

    <p className="mb-4"><strong style={{ color: ink }}>2. Information We Collect</strong><br />
    Account information (name, email, hashed password), content you upload or generate (syllabi, questions, assessments, TOS data), and basic usage data for troubleshooting.</p>

    <p className="mb-4"><strong style={{ color: ink }}>3. How We Use Your Information</strong><br />
    To authenticate your account, control role-based access, generate and classify assessment questions, and improve classification accuracy.</p>

    <p className="mb-4"><strong style={{ color: ink }}>4. Data Storage and Security</strong><br />
    Data is stored in PostgreSQL. Passwords are never stored in plain text, and admin functions are restricted by role.</p>

    <p className="mb-4"><strong style={{ color: ink }}>5. Third-Party Services</strong><br />
    Question generation uses a third-party AI provider solely to produce classification results.</p>

    <p className="mb-4"><strong style={{ color: ink }}>6. Your Rights</strong><br />
    You may request access to, correction of, or deletion of your data by contacting your administrator.</p>

    <p><strong style={{ color: ink }}>7. Contact</strong><br />
    Questions about this policy can be directed to your institution&apos;s BloomQuest administrator.</p>
  </>
);

const termsContent = (
  <>
    <p className="mb-4"><strong style={{ color: ink }}>1. Acceptance of Terms</strong><br />
    By using BloomQuest, you agree to be bound by these Terms of Service.</p>

    <p className="mb-4"><strong style={{ color: ink }}>2. Account Access</strong><br />
    Accounts are provisioned by your administrator. You are responsible for keeping your credentials confidential and for all activity under your account.</p>

    <p className="mb-4"><strong style={{ color: ink }}>3. Acceptable Use</strong><br />
    You agree not to share credentials, upload content you don&apos;t have rights to, access unauthorized data or admin functions, or use the platform for unlawful or academically dishonest purposes.</p>

    <p className="mb-4"><strong style={{ color: ink }}>4. Generated Content</strong><br />
    Generated questions and assessments are a drafting aid. You are responsible for reviewing them for accuracy before instructional use.</p>

    <p className="mb-4"><strong style={{ color: ink }}>5. Availability</strong><br />
    BloomQuest is provided &quot;as available&quot; and may be updated or temporarily unavailable during maintenance.</p>

    <p className="mb-4"><strong style={{ color: ink }}>6. Termination</strong><br />
    Access may be suspended or terminated for violating these terms.</p>

    <p><strong style={{ color: ink }}>7. Changes to These Terms</strong><br />
    These terms may be updated periodically. Continued use after changes take effect means you accept the revised terms.</p>
  </>
);

const LegalModal = ({ type, onClose }) => {
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);
  const lastType = useRef(type);

  useEffect(() => {
    if (type) {
      lastType.current = type;
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  const isPrivacy = lastType.current === "privacy";

  const handleAnimationEnd = () => {
    if (closing) setRendered(false);
  };

  return (
    <div
      className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(20,20,15,0.45)",
        animation: closing
          ? "legalOverlayOut 180ms ease-in forwards"
          : "legalOverlayIn 200ms ease-out forwards",
      }}
      onClick={onClose}
    >
      <div
        className="bq-modal-panel legal-document w-full max-w-[760px] max-h-[84vh] flex flex-col overflow-hidden rounded-2xl"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(20,20,15,0.12)',
          boxShadow: '0 28px 80px rgba(20,20,15,0.2)',
          animation: closing
            ? "legalModalOut 180ms ease-in forwards"
            : "legalModalIn 220ms ease-out forwards",
        }}
        onAnimationEnd={handleAnimationEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-4 px-6 py-5 sm:px-8"
          style={{ background: 'linear-gradient(135deg, #B4454A 0%, #8F1C2B 100%)', borderBottom: '1px solid rgba(255,255,255,0.16)' }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-36 shrink-0 items-center justify-center rounded-xl bg-white/15 px-3 ring-1 ring-white/25">
              <img src={bloomquestLogo} alt="BloomQuest" className="legal-brand-logo h-auto w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">BloomQuest policies</p>
              <h2 className="mt-1 truncate text-xl font-bold text-white" style={{ letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif' }}>
                {isPrivacy ? "Privacy Policy" : "Terms of Service"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Close policy dialog"
          >
            &times;
          </button>
        </div>

        <div className="legal-content overflow-y-auto px-6 py-6 text-sm leading-7 sm:px-8 sm:py-7" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
          <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'rgba(20,20,15,0.08)' }}>
            <p className="text-xs font-medium" style={{ color: textMuted }}>Please review this document carefully.</p>
            <span className="shrink-0 rounded-full bg-[#FBEDEE] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8F1C2B]">Official policy</span>
          </div>
          {isPrivacy ? privacyContent : termsContent}
        </div>

        <div className="border-t px-6 py-3 sm:px-8" style={{ backgroundColor: '#FAF9F7', borderColor: 'rgba(20,20,15,0.1)' }}>
          <p className="text-xs" style={{ color: textMuted }}>BloomQuest · Institutional workspace</p>
        </div>
      </div>

      <style>{`
        .legal-content p { margin: 0 0 1.1rem; }
        .legal-content p:last-child { margin-bottom: 0; }
        .legal-brand-logo { max-width: 8rem; }
        .legal-content strong { display: block; margin-bottom: 0.15rem; color: ${ink}; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .legal-content br { display: none; }
        .legal-content::-webkit-scrollbar { width: 8px; }
        .legal-content::-webkit-scrollbar-thumb { border: 2px solid #fff; border-radius: 999px; background: rgba(180,69,74,0.32); }
        @keyframes legalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes legalOverlayOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes legalModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes legalModalOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.95) translateY(8px); }
        }
      `}</style>
    </div>
  );
};

export default LegalModal;