import React, { useEffect, useRef, useState } from "react";

const privacyContent = (
  <>
    <p className="mb-3"><strong>1. Overview</strong><br />
    BloomQuest is an educational platform that helps instructors classify questions according to Bloom's Taxonomy and build assessments. This policy explains what information we collect, how we use it, and how we protect it.</p>

    <p className="mb-3"><strong>2. Information We Collect</strong><br />
    Account information (name, email, hashed password), content you upload or generate (syllabi, questions, assessments, TOS data), and basic usage data for troubleshooting.</p>

    <p className="mb-3"><strong>3. How We Use Your Information</strong><br />
    To authenticate your account, control role-based access, generate and classify assessment questions, and improve classification accuracy.</p>

    <p className="mb-3"><strong>4. Data Storage and Security</strong><br />
    Data is stored in PostgreSQL. Passwords are never stored in plain text, and admin functions are restricted by role.</p>

    <p className="mb-3"><strong>5. Third-Party Services</strong><br />
    Question generation uses a third-party AI provider solely to produce classification results.</p>

    <p className="mb-3"><strong>6. Your Rights</strong><br />
    You may request access to, correction of, or deletion of your data by contacting your administrator.</p>

    <p><strong>7. Contact</strong><br />
    Questions about this policy can be directed to your institution's BloomQuest administrator.</p>
  </>
);

const termsContent = (
  <>
    <p className="mb-3"><strong>1. Acceptance of Terms</strong><br />
    By using BloomQuest, you agree to be bound by these Terms of Service.</p>

    <p className="mb-3"><strong>2. Account Access</strong><br />
    Accounts are provisioned by your administrator. You are responsible for keeping your credentials confidential and for all activity under your account.</p>

    <p className="mb-3"><strong>3. Acceptable Use</strong><br />
    You agree not to share credentials, upload content you don't have rights to, access unauthorized data or admin functions, or use the platform for unlawful or academically dishonest purposes.</p>

    <p className="mb-3"><strong>4. Generated Content</strong><br />
    Generated questions and assessments are a drafting aid. You are responsible for reviewing them for accuracy before instructional use.</p>

    <p className="mb-3"><strong>5. Availability</strong><br />
    BloomQuest is provided "as available" and may be updated or temporarily unavailable during maintenance.</p>

    <p className="mb-3"><strong>6. Termination</strong><br />
    Access may be suspended or terminated for violating these terms.</p>

    <p><strong>7. Changes to These Terms</strong><br />
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        animation: closing
          ? "legalOverlayOut 180ms ease-in forwards"
          : "legalOverlayIn 200ms ease-out forwards",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        style={{
          animation: closing
            ? "legalModalOut 180ms ease-in forwards"
            : "legalModalIn 220ms ease-out forwards",
        }}
        onAnimationEnd={handleAnimationEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-lg"
          style={{ backgroundColor: "#7B1113" }}
        >
          <h2 className="text-lg font-bold text-white">
            {isPrivacy ? "Privacy Policy" : "Terms of Service"}
          </h2>
          <button
            onClick={onClose}
            className="text-white text-xl leading-none hover:text-gray-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-sm text-gray-700 leading-relaxed">
          {isPrivacy ? privacyContent : termsContent}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-white font-semibold text-sm"
            style={{ backgroundColor: "#B01C1C" }}
          >
            Close
          </button>
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