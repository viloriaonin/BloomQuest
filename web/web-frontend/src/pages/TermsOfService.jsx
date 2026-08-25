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

const TermsOfService = () => {
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
          BloomQuest · Terms of Service
        </span>
      </div>

      <div className="flex-1 px-6 py-6 flex justify-center">
        <div className="w-full max-w-md rounded-[12px] p-8 md:p-10" style={{ backgroundColor: surface, border: `1px solid ${rule}`, boxShadow: '0 4px 16px rgba(20, 20, 15, 0.08)' }}>
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl mb-3" style={{ color: ink, fontFamily: 'Fraunces, serif', fontWeight: 500, letterSpacing: '-0.02em' }}>Terms of Service</h1>
            <div className="w-14 h-0.5 mb-3" style={{ backgroundColor: accent }} />
            <p className="text-sm" style={{ color: textMuted, fontFamily: 'Inter, sans-serif' }}>Last updated: July 2026</p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using BloomQuest, you agree to be bound by these
              Terms of Service. If you do not agree, do not use the platform.
            </p>
          </Section>

          <Section title="2. Account Access">
            <p>
              Accounts are provisioned by your institution&apos;s administrator.
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
              BloomQuest is provided on an &quot;as available&quot; basis. Features may be
              updated, changed, or temporarily unavailable during maintenance.
            </p>
          </Section>

          <Section title="6. Termination">
            <p>
              Access may be suspended or terminated for violation of these terms
              or at the discretion of your institution&apos;s administrator.
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

export default TermsOfService;