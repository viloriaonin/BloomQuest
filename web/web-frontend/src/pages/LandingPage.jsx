import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  FileCheck2,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import PublicNav from "../components/PublicNav";

const accent = "#B4454A";
const accentStrong = "#8F1C2B";
const ink = "#17171A";
const muted = "#6F6C64";
const paper = "#F7F6F3";

const workflow = [
  {
    number: "01",
    icon: FileText,
    title: "Bring your materials",
    text: "Upload your instructional module and CIS or syllabus. BloomQuest reads the structure you already use.",
  },
  {
    number: "02",
    icon: BrainCircuit,
    title: "Shape the assessment",
    text: "Choose question types, points, item counts, topics, and Bloom's Taxonomy distribution.",
  },
  {
    number: "03",
    icon: FileCheck2,
    title: "Review and publish",
    text: "Review generated questions, save them to your Question Bank, and export a polished TOS and test.",
  },
];

const features = [
  {
    icon: GraduationCap,
    title: "Built for faculty workflows",
    text: "Keep subjects, topics, question types, and assessment history organized in one workspace.",
  },
  {
    icon: BrainCircuit,
    title: "Bloom-aware generation",
    text: "Generate questions across Remember, Understand, Apply, Analyze, Evaluate, and Create.",
  },
  {
    icon: BookOpenCheck,
    title: "A reusable Question Bank",
    text: "Save, review, filter, and reuse questions instead of rebuilding every assessment from scratch.",
  },
  {
    icon: ShieldCheck,
    title: "Review stays in your hands",
    text: "Generated content is a drafting aid. Faculty review every question before instructional use.",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  const goTo = (path) => {
    navigate(path);
  };

  return (
    <div className="bq-landing" style={{ "--bq-accent": accent, "--bq-accent-strong": accentStrong, "--bq-ink": ink, "--bq-muted": muted, "--bq-paper": paper }}>
      <PublicNav />

      <main>
        <section className="bq-landing-hero">
          <div className="bq-hero-grid" />
          <div className="bq-hero-copy">
            <div className="bq-kicker"><Sparkles size={14} /> Smarter assessment preparation</div>
            <h1>Turn your course materials into <em>better assessments.</em></h1>
            <p className="bq-hero-lede">BloomQuest helps educators transform instructional materials and CIS documents into structured, reviewable assessments aligned to Bloom's Taxonomy.</p>
            <div className="bq-hero-actions">
              <button type="button" className="bq-primary-button" onClick={() => goTo("/login")}>Sign in to BloomQuest <ArrowRight size={17} /></button>
              <button type="button" className="bq-text-button" onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}>See how it works <ChevronDown size={16} /></button>
            </div>
            <div className="bq-hero-note"><ShieldCheck size={15} /> Designed for faculty review, control, and responsible use.</div>
          </div>
          <div className="bq-hero-visual" aria-label="BloomQuest assessment workspace preview">
            <div className="bq-visual-orbit orbit-one" />
            <div className="bq-visual-orbit orbit-two" />
            <div className="bq-preview-window">
              <div className="bq-preview-top"><span className="bq-preview-dots"><i /><i /><i /></span><span>Assessment workspace</span><span className="bq-preview-status">Ready</span></div>
              <div className="bq-preview-body">
                <div className="bq-preview-sidebar"><span className="active"><Sparkles size={14} /> New analysis</span><span><BookOpenCheck size={14} /> Question bank</span><span><FileCheck2 size={14} /> TOS exports</span></div>
                <div className="bq-preview-content">
                  <div className="bq-preview-heading"><div><small>ASSESSMENT BUILDER</small><h3>Foundations of Analytics</h3></div><span className="bq-preview-pill">In review</span></div>
                  <div className="bq-preview-metrics"><div><small>Questions</small><strong>40</strong></div><div><small>Bloom levels</small><strong>6</strong></div><div><small>Topics</small><strong>08</strong></div></div>
                  <div className="bq-preview-table"><div className="table-head"><span>Topic distribution</span><span>Weight</span></div><div><span><b className="bar-dot red" />Predictive modeling</span><strong>32%</strong></div><div><span><b className="bar-dot gold" />Data preprocessing</span><strong>24%</strong></div><div><span><b className="bar-dot slate" />Model evaluation</span><strong>44%</strong></div></div>
                  <div className="bq-preview-footer"><span><Check size={14} /> TOS structure complete</span><span>Review questions <ArrowRight size={13} /></span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bq-trust-strip" id="trust"><div><span className="trust-mark">01</span><p><strong>Aligned by design</strong><br />Built around your learning outcomes</p></div><div><span className="trust-mark">02</span><p><strong>Reviewable by default</strong><br />Faculty stays in the decision loop</p></div><div><span className="trust-mark">03</span><p><strong>Ready to reuse</strong><br />One bank for every assessment cycle</p></div></section>

        <section className="bq-section bq-platform-section" id="platform">
          <div className="bq-section-intro"><div className="bq-kicker">One connected workspace</div><h2>From source material to assessment day, with fewer loose ends.</h2><p>BloomQuest brings the planning, generation, review, and export steps into a calm, structured workflow made for real academic teams.</p></div>
          <div className="bq-feature-grid">{features.map(({ icon: Icon, title, text }) => <article className="bq-feature-card" key={title}><span className="bq-feature-icon"><Icon size={21} /></span><h3>{title}</h3><p>{text}</p><span className="bq-card-line" /></article>)}</div>
        </section>

        <section className="bq-section bq-workflow-section" id="workflow">
          <div className="bq-section-intro centered"><div className="bq-kicker">A clear path forward</div><h2>Build once. Review carefully. Reuse confidently.</h2><p>Every step is visible, so your assessment process stays understandable from upload to export.</p></div>
          <div className="bq-workflow-grid">{workflow.map(({ number, icon: Icon, title, text }) => <article className="bq-workflow-card" key={number}><div className="bq-workflow-number">{number}</div><span className="bq-workflow-icon"><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="bq-quote-section"><div className="bq-quote-mark">“</div><blockquote>Good assessment design should make the learning intent clearer, not make the workload heavier.</blockquote><p>BloomQuest brings structure to the work behind meaningful assessment.</p></section>

        <section className="bq-landing-cta"><div><div className="bq-kicker">Start with your next assessment</div><h2>Make the next question set your clearest one yet.</h2><p>Sign in to bring BloomQuest into your faculty workflow.</p></div><button type="button" className="bq-light-button" onClick={() => goTo("/login")}>Sign in <ArrowRight size={17} /></button></section>
      </main>

      <footer className="bq-landing-footer"><p className="bq-footer-note">Assessment intelligence for thoughtful educators.</p><p>© 2026 BloomQuest. Built for thoughtful assessment.</p></footer>
    </div>
  );
};

export default LandingPage;