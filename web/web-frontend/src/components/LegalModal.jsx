import React, { useEffect, useRef, useState } from "react";
import bloomquestLogo from "../assets/images/bloomquest-logo.png";

const accent = '#B4454A';
const ink = '#17171A';
const textMuted = '#6F6C64';

const PolicySection = ({ title, children }) => (
  <section className="legal-section">
    <h3>{title}</h3>
    <div>{children}</div>
  </section>
);

const privacyContent = (
  <>
    <div className="legal-introduction">
      <p>This Privacy Policy explains how BloomQuest collects, uses, stores, and protects information when you use the platform.</p>
    </div>

    <PolicySection title="1. Scope and Purpose">
      <p>BloomQuest is an educational assessment platform that helps instructors organize course materials, classify questions according to Bloom&apos;s Taxonomy, and prepare assessments. This policy applies to information processed through the BloomQuest web and mobile applications.</p>
    </PolicySection>

    <PolicySection title="2. Information We Collect">
      <p>We may collect account information such as your name, email address, and securely hashed password; content you upload or generate, including syllabi, questions, assessments, and Table of Specifications data; and basic usage information needed for authentication, security, and troubleshooting.</p>
    </PolicySection>

    <PolicySection title="3. How We Use Information">
      <p>Information is used to authenticate accounts, provide role-based access, generate and classify assessment content, maintain platform security, respond to support requests, and improve the reliability of BloomQuest&apos;s classification features.</p>
    </PolicySection>

    <PolicySection title="4. Storage and Security">
      <p>Information is stored in a PostgreSQL database. Passwords are not stored in plain text, and administrative capabilities are restricted through role-based permissions. We apply reasonable technical and organizational safeguards appropriate to the platform and its intended institutional use.</p>
    </PolicySection>

    <PolicySection title="5. Third-Party Services">
      <p>Some question-generation and classification features use a third-party AI provider. Relevant content may be processed by that provider to deliver the requested platform function. BloomQuest does not use uploaded content to train external models on your institution&apos;s behalf.</p>
    </PolicySection>

    <PolicySection title="6. Your Choices and Rights">
      <p>You may request access to, correction of, or deletion of your account data by contacting your institution&apos;s BloomQuest administrator. Your administrator may also manage access to institutional content in accordance with applicable policies.</p>
    </PolicySection>

    <PolicySection title="7. Contact and Updates">
      <p>Questions about this policy should be directed to your institution&apos;s BloomQuest administrator. We may update this policy from time to time and will reflect the effective date above when changes are made.</p>
    </PolicySection>
  </>
);

const termsContent = (
  <>
    <div className="legal-introduction">
      <p>These Terms of Service establish the conditions for using BloomQuest and its assessment-generation tools.</p>
    </div>

    <PolicySection title="1. Acceptance of Terms">
      <p>By accessing or using BloomQuest, you acknowledge that you have read and agree to these Terms of Service. If you do not agree with them, you must not use the platform.</p>
    </PolicySection>

    <PolicySection title="2. Account Access and Responsibilities">
      <p>Accounts are provisioned and managed by your institution&apos;s administrator. You are responsible for keeping your credentials confidential, using your assigned account, and promptly reporting suspected unauthorized access.</p>
    </PolicySection>

    <PolicySection title="3. Acceptable Use">
      <p>You may not share credentials, upload content you do not have the right to use, access data or administrative functions without authorization, interfere with platform security, or use BloomQuest for unlawful, harmful, or academically dishonest purposes.</p>
    </PolicySection>

    <PolicySection title="4. Generated Content and Review">
      <p>Questions, classifications, and assessments produced through BloomQuest are drafting aids. You and your institution remain responsible for reviewing generated content for accuracy, suitability, accessibility, and alignment with instructional requirements before use.</p>
    </PolicySection>

    <PolicySection title="5. Availability and Changes">
      <p>BloomQuest is provided on an &quot;as available&quot; basis. Features may be changed, improved, or temporarily unavailable during maintenance, updates, or circumstances beyond our reasonable control.</p>
    </PolicySection>

    <PolicySection title="6. Suspension or Termination">
      <p>Access may be suspended or terminated by your institution&apos;s administrator or by BloomQuest where necessary to protect the platform, its users, or institutional data, or where these terms are violated.</p>
    </PolicySection>

    <PolicySection title="7. Updates and Contact">
      <p>These terms may be updated periodically. Continued use of BloomQuest after an updated version takes effect constitutes acceptance of the revised terms. Questions should be directed to your institution&apos;s BloomQuest administrator.</p>
    </PolicySection>
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
          <div className="legal-document-meta mb-6 flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'rgba(20,20,15,0.08)' }}>
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
        .legal-content p { margin: 0; }
        .legal-introduction { margin-bottom: 1.8rem; padding: 1rem 1.1rem; border-left: 3px solid ${accent}; background: #FAF9F7; color: ${ink}; font-size: 0.93rem; line-height: 1.7; }
        .legal-section { margin-bottom: 1.65rem; }
        .legal-section:last-child { margin-bottom: 0; }
        .legal-section h3 { margin: 0 0 0.45rem; color: ${ink}; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; line-height: 1.4; text-transform: uppercase; }
        .legal-section > div { line-height: 1.8; }
        .legal-brand-logo { max-width: 8rem; }
        .legal-document-meta span { white-space: nowrap; }
        @media (max-width: 520px) { .legal-document-meta { align-items: flex-start; flex-direction: column; } }
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