"use client"

import { cn } from "@/lib/utils"
import type { Page } from "@/app/page"

const tabs = [
  { id: "repo-overview", label: "Overview" },
  { id: "repo-docs", label: "Docs" },
  { id: "repo-analysis", label: "Analysis" },
  { id: "repo-settings", label: "Settings" },
] as const

interface RepoTabsProps {
  currentTab: string
  onNavigate: (page: Page) => void
}

export function RepoTabs({ currentTab, onNavigate }: RepoTabsProps) {
  return (
    <div className="border-b border-border">
      <nav className="flex gap-0 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id as Page)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              currentTab === tab.id.replace("repo-", "")
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
