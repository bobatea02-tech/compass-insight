import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Compass — Dependency Intelligence" },
      { name: "description", content: "Real-time dependency health and risk intelligence for developers." },
      { property: "og:title", content: "Compass — Dependency Intelligence" },
      { property: "og:description", content: "Real-time dependency health and risk intelligence for developers." },
    ],
  }),
  component: App,
});
