import React, { useEffect, useRef, useState } from "react";

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
        className="bq-modal-panel w-full max-w-[700px] max-h-[80vh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#F8F7F5',
          border: '1px solid rgba(20,20,15,0.14)',
          animation: closing
            ? "legalModalOut 180ms ease-in forwards"
            : "legalModalIn 220ms ease-out forwards",
        }}
        onAnimationEnd={handleAnimationEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: accent, borderBottom: '1px solid rgba(20,20,15,0.08)' }}
        >
          <h2 className="text-[1.05rem] font-bold text-white" style={{ letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif' }}>
            {isPrivacy ? "Privacy Policy" : "Terms of Service"}
          </h2>
          <button
            onClick={onClose}
            className="text-white text-2xl leading-none hover:opacity-80"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-[1.05rem] leading-relaxed" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
          {isPrivacy ? privacyContent : termsContent}
        </div>

        <div className="px-6 py-3 border-t" style={{ backgroundColor: '#F5F3EE', borderTop: '1px solid rgba(20,20,15,0.14)' }}>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-white font-semibold text-base transition hover:opacity-90"
              style={{ backgroundColor: accent, minWidth: 110, fontFamily: 'Inter, sans-serif' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
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