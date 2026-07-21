import React from "react";
import { useNavigate } from "react-router-dom";

const Section = ({ title, children }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold mb-2" style={{ color: "#7B1113" }}>
      {title}
    </h2>
    <div className="text-base text-gray-700 leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <div
        className="w-full py-10 px-6 flex flex-col items-center"
        style={{
          background: "radial-gradient(circle at 50% 35%, #9c1c1f 0%, #7B1113 55%, #5c0d0f 100%)",
        }}
      >
        <h1 className="text-3xl font-bold text-white mb-1">Terms of Service</h1>
        <div className="w-16 h-1 rounded-full mb-2" style={{ backgroundColor: "#D4AF37" }} />
        <p className="text-sm" style={{ color: "#e8c97a" }}>Last updated: July 2026</p>
      </div>

      <div className="flex-1 bg-gray-50 px-6 py-10 flex justify-center">
        <div className="w-full max-w-2xl">

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using BloomQuest, you agree to be bound by these
              Terms of Service. If you do not agree, do not use the platform.
            </p>
          </Section>

          <Section title="2. Account Access">
            <p>
              Accounts are provisioned by your institution's administrator.
              Standard accounts are directed to the dashboard; administrator
              accounts have access to additional management tools.
            </p>
            <p>
              You are responsible for keeping your login credentials confidential
              and for all activity under your account.
            </p>
          </Section>

          <Section title="3. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Share your account credentials with others</li>
              <li>Upload content you do not have the right to use</li>
              <li>Attempt to access accounts, data, or admin functions you are not authorized to use</li>
              <li>Use the platform to generate content that is unlawful, harassing, or academically dishonest</li>
            </ul>
          </Section>

          <Section title="4. Generated Content">
            <p>
              Questions, classifications, and assessments generated through the
              platform are provided as a drafting aid. You are responsible for
              reviewing generated content for accuracy before instructional use.
            </p>
          </Section>

          <Section title="5. Availability">
            <p>
              BloomQuest is provided on an "as available" basis. Features may be
              updated, changed, or temporarily unavailable during maintenance.
            </p>
          </Section>

          <Section title="6. Termination">
            <p>
              Access may be suspended or terminated for violation of these terms
              or at the discretion of your institution's administrator.
            </p>
          </Section>

          <Section title="7. Changes to These Terms">
            <p>
              These terms may be updated periodically. Continued use of the
              platform after changes take effect constitutes acceptance of the
              revised terms.
            </p>
          </Section>

          <button
            onClick={() => navigate("/login")}
            className="mt-4 font-semibold hover:underline"
            style={{ color: "#B01C1C" }}
          >
            ← Back to login
          </button>

        </div>
      </div>
    </div>
  );
};

export default TermsOfService;