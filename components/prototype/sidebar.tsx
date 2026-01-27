"use client"

import type React from "react"
import { useState } from "react"
import {
  LayoutDashboard,
  FolderGit2,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Page, ActiveRepo } from "@/app/page"

const repos = [
  { owner: "vercel", name: "next.js" },
  { owner: "my-org", name: "api-server" },
  { owner: "my-org", name: "docs-site" },
  { owner: "user", name: "portfolio" },
]

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggleCollapse: () => void
  activeRepo: ActiveRepo
  onRepoClick: (owner: string, name: string) => void
}

export function Sidebar({
  currentPage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  activeRepo,
  onRepoClick,
}: SidebarProps) {
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [showDocsTooltip, setShowDocsTooltip] = useState(false)

  return (
    <aside
      className={cn(
        "border-r border-border bg-muted/30 flex flex-col sticky top-14 h-[calc(100vh-57px)] transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="space-y-1 px-3">
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={currentPage === "dashboard"}
            onClick={() => onNavigate("dashboard")}
            collapsed={collapsed}
          />
          <SidebarItem
            icon={FolderGit2}
            label="Repositories"
            active={currentPage === "repos"}
            onClick={() => onNavigate("repos")}
            collapsed={collapsed}
          />
        </nav>

        {!collapsed && (
          <>
            <div className="px-3 mt-6 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Repos</span>
            </div>
            <nav className="space-y-0.5 px-3">
              {repos.map((repo) => (
                <button
                  key={`${repo.owner}/${repo.name}`}
                  onClick={() => onRepoClick(repo.owner, repo.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-left",
                    activeRepo?.owner === repo.owner && activeRepo?.name === repo.name
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <span className="truncate">{repo.name}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        <div className="border-t border-border mt-6 pt-4 px-3 space-y-1">
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={currentPage === "settings"}
            onClick={() => onNavigate("settings")}
            collapsed={collapsed}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border p-3 space-y-1">
          <div className="relative">
            <SidebarItem
              icon={HelpCircle}
              label="Help"
              collapsed={collapsed}
              onClick={() => setShowHelpTooltip(!showHelpTooltip)}
            />
            {showHelpTooltip && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-background border border-border rounded-md shadow-lg p-2">
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">Documentation</button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">
                  Contact Support
                </button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">FAQ</button>
              </div>
            )}
          </div>
          <div className="relative">
            <SidebarItem
              icon={ExternalLink}
              label="Docs"
              collapsed={collapsed}
              onClick={() => window.open("https://docs.example.com", "_blank")}
            />
          </div>
        </div>
      )}

      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="w-full justify-center text-muted-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  )
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
  collapsed: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
