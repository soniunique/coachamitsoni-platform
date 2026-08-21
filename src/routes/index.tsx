import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { About, Credibility, Experience, Offers, Skills, Testimonials, Workshops } from "@/components/site/Sections";
import { Contact, Footer } from "@/components/site/Contact";

const title = "Amit Soni — AI Agents Educator | Cloud Architecture";
const description = "AI education, practical AI agents and professional career/product experience for working professionals.";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title },
    { name: "description", content: description },
    { name: "author", content: "Amit Soni" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "profile" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  return <div className="min-h-screen bg-background"><Header/><main><Hero/><About/><Offers/><Experience/><Skills/><Workshops/><Contact/></main><Footer/></div>;
}
