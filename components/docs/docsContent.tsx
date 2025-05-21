import React from "react";
import { Home, Zap, LayoutDashboard, ChevronsRight, Cog, Info, Tags } from "lucide-react";
import welcome from "@/docs/welcome";
import gettingStarted from "@/docs/getting-started";
import ui from "@/docs/ui";
import classifications from "@/docs/classifications";
import rules from "@/docs/rules";
import settings from "@/docs/settings";
import workflow from "@/docs/workflow";
import { translations, Language } from "@/lib/i18n";

export const getDocSections = (lang: Language) => [
  { id: "general", title: translations[lang].doc_welcome_title, icon: <Home className="h-5 w-5" />, content: welcome[lang] },
  { id: "getting-started", title: translations[lang].doc_getting_started_title, icon: <Zap className="h-5 w-5" />, content: gettingStarted[lang] },
  { id: "ui", title: translations[lang].doc_ui_title, icon: <LayoutDashboard className="h-5 w-5" />, content: ui[lang] },
  { id: "classifications", title: translations[lang].doc_classifications_title, icon: <Tags className="h-5 w-5 flex-shrink-0" />, content: classifications[lang] },
  { id: "rules", title: translations[lang].doc_rules_title, icon: <ChevronsRight className="h-5 w-5" />, content: rules[lang] },
  { id: "settings", title: translations[lang].doc_settings_title, icon: <Cog className="h-5 w-5" />, content: settings[lang] },
  { id: "workflow", title: translations[lang].doc_workflow_title, icon: <Info className="h-5 w-5" />, content: workflow[lang] },
] as const;

export type DocSection = ReturnType<typeof getDocSections>[number];
