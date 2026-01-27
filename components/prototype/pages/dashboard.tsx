"use client"

import { FolderGit2, FileText, Activity, Zap, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const stats = [
  { label: "Repositories", value: "12", icon: FolderGit2 },
  { label: "Docs Generated", value: "8", icon: FileText },
  { label: "Analyses", value: "24", icon: Activity },
  { label: "API Calls", value: "1,240", icon: Zap },
]

const recentRepos = [
  { owner: "vercel", name: "next.js", status: "ready", lastAnalysis: "2 hours ago" },
  { owner: "my-org", name: "api-server", status: "pending", lastAnalysis: "1 day ago" },
  { owner: "my-org", name: "docs-site", status: "ready", lastAnalysis: "3 days ago" },
]

interface DashboardPageProps {
  onRepoClick: (owner: string, name: string) => void
  onAddRepo: () => void
  onViewDocs?: (owner: string, name: string) => void
  onRunAnalysis?: (owner: string, name: string) => void
}

export function DashboardPage({ onRepoClick, onAddRepo, onViewDocs, onRunAnalysis }: DashboardPageProps) {
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <stat.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Repos */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Recent Repositories</h2>
        <Button size="sm" onClick={onAddRepo}>
          <Plus className="w-4 h-4 mr-2" />
          Add Repository
        </Button>
      </div>

      <div className="space-y-3">
        {recentRepos.map((repo) => (
          <Card
            key={`${repo.owner}/${repo.name}`}
            className="bg-card hover:bg-accent/30 transition-colors cursor-pointer"
            onClick={() => onRepoClick(repo.owner, repo.name)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <FolderGit2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {repo.owner}/{repo.name}
                  </p>
                  <p className="text-sm text-muted-foreground">Last analysis: {repo.lastAnalysis}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={repo.status} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (repo.status === "ready") {
                      onRepoClick(repo.owner, repo.name)
                    } else {
                      onRepoClick(repo.owner, repo.name)
                    }
                  }}
                >
                  {repo.status === "ready" ? "View Docs" : "Run Analysis"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          status === "ready" ? "bg-green-500" : status === "pending" ? "bg-yellow-500" : "bg-muted-foreground",
        )}
      />
      <span className="text-sm text-muted-foreground capitalize">{status}</span>
    </div>
  )
}
