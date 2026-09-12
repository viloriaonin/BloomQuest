import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import bloomquestLogo from "../assets/images/bloomquest-logo.png";

const PublicNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const onLandingPage = location.pathname === "/" || location.pathname === "/home";

  const sectionHref = (section) => (onLandingPage ? `#${section}` : `/#${section}`);
  const handleSectionNavigation = (event, section) => {
    event.preventDefault();
    setMobileMenuOpen(false);

    if (onLandingPage) {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${section}`);
      return;
    }

    navigate(`/#${section}`);
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };
  const goTo = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="bq-landing-nav bq-public-nav">
      <button type="button" className="bq-landing-brand" onClick={() => goTo("/")} aria-label="BloomQuest home">
        <span className="bq-landing-logo-wrap bq-public-logo"><img src={bloomquestLogo} alt="" /></span>
        <span><strong>BloomQuest</strong><small>Assessment intelligence</small></span>
      </button>
      <nav className={`bq-landing-links ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <a href={sectionHref("platform")} onClick={(event) => handleSectionNavigation(event, "platform")}>Platform</a>
        <a href={sectionHref("workflow")} onClick={(event) => handleSectionNavigation(event, "workflow")}>How it works</a>
        <a href={sectionHref("trust")} onClick={(event) => handleSectionNavigation(event, "trust")}>Why BloomQuest</a>
        <button type="button" className="bq-nav-login" onClick={() => goTo("/login")}>Sign in</button>
      </nav>
      <button type="button" className="bq-menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}>
        {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
};

export default PublicNav;
