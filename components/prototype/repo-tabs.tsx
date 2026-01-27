"use client"

import { cn } from "@/lib/utils"
import { FileText, BarChart3, History, Settings, LayoutDashboard } from "lucide-react"
import type { Page } from "@/app/page"

const tabs = [
  { id: "repo-overview", label: "Overview", icon: LayoutDashboard },
  { id: "repo-docs", label: "Docs", icon: FileText },
  { id: "repo-metrics", label: "Metrics", icon: BarChart3 },
  { id: "repo-history", label: "History", icon: History },
  { id: "repo-settings", label: "Settings", icon: Settings },
] as const

interface RepoTabsProps {
  currentTab: string
  onNavigate: (page: Page) => void
}

export function RepoTabs({ currentTab, onNavigate }: RepoTabsProps) {
  return (
    <div className="border-b border-border">
      <nav className="flex gap-0 -mb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id as Page)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                currentTab === tab.id.replace("repo-", "")
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
