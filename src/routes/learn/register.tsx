import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/learn/AuthCard";
export const Route = createFileRoute("/learn/register")({ component: () => <AuthCard mode="register" /> });
