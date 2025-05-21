import React from "react";
import { Home, Zap, LayoutDashboard, FileText, ChevronsRight, Cog, Info, List, Tags, FolderTree } from "lucide-react";

import welcome from "@/docs/welcome";
import gettingStarted from "@/docs/getting-started";
import ui from "@/docs/ui";
import classifications from "@/docs/classifications";
import rules from "@/docs/rules";
import settings from "@/docs/settings";
import workflow from "@/docs/workflow";

export const DOC_SECTIONS = [
  { id: "general", title: "Welcome!", icon: <Home className="h-5 w-5" />, content: welcome },
  { id: "getting-started", title: "Getting Started", icon: <Zap className="h-5 w-5" />, content: gettingStarted },
  { id: "ui", title: "Interface & 3D", icon: <LayoutDashboard className="h-5 w-5" />, content: ui },
  { id: "classifications", title: "Classifications", icon: <Tags className="h-5 w-5 flex-shrink-0" />, content: classifications },
  { id: "rules", title: "Rules", icon: <ChevronsRight className="h-5 w-5" />, content: rules },
  { id: "settings", title: "Settings", icon: <Cog className="h-5 w-5" />, content: settings },
  { id: "workflow", title: "Typical Workflow", icon: <Info className="h-5 w-5" />, content: workflow },
] as const;

export type DocSection = (typeof DOC_SECTIONS)[number];
