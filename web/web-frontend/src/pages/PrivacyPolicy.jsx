import React from "react";
import { useNavigate } from "react-router-dom";

const paper = '#F7F6F3';
const surface = '#FFFFFF';
const ink = '#14140F';
const textMuted = '#6F6C64';
const rule = 'rgba(20, 20, 15, 0.14)';
const accent = '#B4454A';

const Section = ({ title, children }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold mb-2" style={{ color: ink, fontFamily: 'Fraunces, serif' }}>
      {title}
    </h2>
    <div className="text-base leading-relaxed space-y-2" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>
      {children}
    </div>
  </div>
);

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col page-transition relative" style={{ backgroundColor: paper }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #F7F6F3 0%, #EEF2F8 100%)' }} />
      <div className="absolute -top-20 -right-20 rounded-full opacity-20" style={{ width: 420, height: 420, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
      <div className="absolute -bottom-28 -left-24 rounded-full opacity-15" style={{ width: 500, height: 500, background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />

      <div className="w-full flex justify-center pt-10 pb-2">
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent }}>
          BloomQuest · Privacy Policy
        </span>
      </div>

      <div className="flex-1 px-6 py-6 flex justify-center">
        <div className="w-full max-w-md rounded-[12px] p-8 md:p-10" style={{ backgroundColor: surface, border: `1px solid ${rule}`, boxShadow: '0 4px 16px rgba(20, 20, 15, 0.08)' }}>
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl mb-3" style={{ color: ink, fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
            <div className="w-14 h-0.5 mb-3" style={{ backgroundColor: accent }} />
            <p className="text-sm" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>Last updated: July 2026</p>
          </div>

          <Section title="1. Overview">
            <p>
              BloomQuest is an educational platform that helps instructors classify
              questions according to Bloom&apos;s Taxonomy and build assessments. This
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
              Questions about this policy can be directed to your institution&apos;s
              BloomQuest administrator.
            </p>
          </Section>

          <button
            onClick={() => navigate("/login")}
            className="mt-4 inline-flex items-center gap-2 font-semibold"
            style={{ color: accent, fontFamily: 'Inter, sans-serif' }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;