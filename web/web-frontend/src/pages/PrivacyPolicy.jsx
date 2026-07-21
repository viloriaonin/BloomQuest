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

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <div
        className="w-full py-10 px-6 flex flex-col items-center"
        style={{
          background: "radial-gradient(circle at 50% 35%, #9c1c1f 0%, #7B1113 55%, #5c0d0f 100%)",
        }}
      >
        <h1 className="text-3xl font-bold text-white mb-1">Privacy Policy</h1>
        <div className="w-16 h-1 rounded-full mb-2" style={{ backgroundColor: "#D4AF37" }} />
        <p className="text-sm" style={{ color: "#e8c97a" }}>Last updated: July 2026</p>
      </div>

      <div className="flex-1 bg-gray-50 px-6 py-10 flex justify-center">
        <div className="w-full max-w-2xl">

          <Section title="1. Overview">
            <p>
              BloomQuest is an educational platform that helps instructors classify
              questions according to Bloom's Taxonomy and build assessments. This
              policy explains what information we collect through the web and
              mobile apps, how we use it, and how we protect it.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>Account information: name, email address, and hashed password.</p>
            <p>
              Content you upload or generate: syllabi, source documents, generated
              questions, assessments, and Table of Specifications data.
            </p>
            <p>
              Usage data: login timestamps, pages visited, and basic device/browser
              information used for troubleshooting.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>To authenticate your account and control access by role (admin or standard user).</p>
            <p>To generate and classify assessment questions using our AI-assisted classifier.</p>
            <p>To improve the reliability and accuracy of the classification system.</p>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Data is stored in a PostgreSQL database and passwords are never stored
              in plain text. Access to administrative functions is restricted by
              role-based permissions.
            </p>
          </Section>

          <Section title="5. Third-Party Services">
            <p>
              Question generation is powered by a third-party AI provider. Uploaded
              content may be processed by this provider solely to generate
              classification results and is not used to train external models on
              our behalf.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>
              You may request access to, correction of, or deletion of your account
              data by contacting your system administrator.
            </p>
          </Section>

          <Section title="7. Contact">
            <p>
              Questions about this policy can be directed to your institution's
              BloomQuest administrator.
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

export default PrivacyPolicy;