import { useEffect, useState } from "react";
import { Menu, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEARN_URL, LINKEDIN_URL } from "./content";
import logo from "@/assets/amit-logo.png";

const NAV = [
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Skills", href: "#skills" },
  { label: "Workshops", href: "#workshops" },
  { label: "Courses", href: "#courses" },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-300", scrolled ? "border-b border-border bg-background/88 backdrop-blur-xl" : "bg-transparent")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 md:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="Amit Soni home">
          <img src={logo} alt="AI Agents & Cloud Architecture Coach" className="h-11 w-auto object-contain" />
          <span className="hidden min-w-0 sm:block">
            <span className="block font-display text-sm font-bold">Amit Soni</span>
            <span className="block truncate text-[0.68rem] text-muted-foreground">AI Agents & Cloud Architecture Coach</span>
          </span>
        </a>

        <nav className="hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {item.label}
            </a>
          ))}
          <a href="#contact" className="btn-base btn-outline-soft">Book a Free Call</a>
          <a href="#courses" className="btn-base btn-cyan">Explore Courses</a>
          <a href={LEARN_URL} target="_blank" rel="noreferrer" className="btn-base btn-violet">
            Student Login <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="icon-link" aria-label="Amit Soni LinkedIn">in</a>
        </nav>

        <button type="button" aria-label="Toggle navigation" onClick={() => setOpen((v) => !v)} className="pill lg:hidden">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background/96 px-5 py-5 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-3">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-primary">
                {item.label}
              </a>
            ))}
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <a href="#contact" onClick={() => setOpen(false)} className="btn-base btn-outline-soft">Book a Free Call</a>
              <a href="#courses" onClick={() => setOpen(false)} className="btn-base btn-cyan">Explore Courses</a>
              <a href={LEARN_URL} target="_blank" rel="noreferrer" className="btn-base btn-violet">Student Login</a>
            </div>
            <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="btn-base btn-outline-soft mt-1">Connect on LinkedIn</a>
          </nav>
        </div>
      )}
    </header>
  );
}
