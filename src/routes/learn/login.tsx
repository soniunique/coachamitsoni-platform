import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/learn/AuthCard";
export const Route = createFileRoute("/learn/login")({ component: () => <AuthCard mode="login" /> });
