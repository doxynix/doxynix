"use client"

import { useState } from "react"
import {
  Play,
  FileText,
  ExternalLink,
  Star,
  GitFork,
  Loader2,
  Check,
  AlertTriangle,
  Eye,
  Clock,
  GitBranch,
  Scale,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface RepoOverviewPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

const commitData = [
  { month: "Jan", commits: 45 },
  { month: "Feb", commits: 62 },
  { month: "Mar", commits: 78 },
  { month: "Apr", commits: 95 },
  { month: "May", commits: 120 },
  { month: "Jun", commits: 85 },
  { month: "Jul", commits: 67 },
  { month: "Aug", commits: 89 },
  { month: "Sep", commits: 110 },
  { month: "Oct", commits: 95 },
  { month: "Nov", commits: 78 },
  { month: "Dec", commits: 102 },
]

const docTypes = [
  { type: "README", status: "ready", version: "v2.1", date: "2 hours ago" },
  { type: "API Docs", status: "ready", version: "v2.1", date: "2 hours ago" },
  { type: "User Guide", status: "pending", version: "-", date: "-" },
  { type: "Changelog", status: "ready", version: "v2.0", date: "3 days ago" },
  { type: "Code Docs", status: "none", version: "-", date: "-" },
]

const criticalIssues = [
  { id: 1, message: "No README.md found", severity: "high" },
  { id: 2, message: "Hardcoded secrets detected in config.js", severity: "critical" },
  { id: 3, message: "High Bus Factor: 1 contributor made 67% of commits", severity: "medium" },
]

export function RepoOverviewPage({ repo, onNavigate }: RepoOverviewPageProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  if (!repo) return null

  const handleRunAnalysis = () => {
    setIsAnalyzing(true)
    setAnalysisComplete(false)
    setTimeout(() => {
      setIsAnalyzing(false)
      setAnalysisComplete(true)
      setTimeout(() => setAnalysisComplete(false), 2000)
    }, 2000)
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{repo.owner}</span>
          <span>/</span>
          <span className="text-foreground font-semibold text-lg">{repo.name}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent"
          onClick={() => window.open(`https://github.com/${repo.owner}/${repo.name}`, "_blank")}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open on GitHub
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-4">The library for web and native user interfaces</p>

      {/* Tabs */}
      <RepoTabs currentTab="overview" onNavigate={onNavigate} />

      {/* Health Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-500">A</div>
              <div className="text-sm text-muted-foreground mt-1">Code Quality</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-500">85%</div>
              <div className="text-sm text-muted-foreground mt-1">Doc Coverage</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-500">3</div>
              <div className="text-sm text-muted-foreground mt-1">Issues</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-lg font-semibold">Active</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">Status</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Left Column */}
        <div className="md:col-span-2 space-y-6">
          {/* Critical Issues */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Critical Issues
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        issue.severity === "critical"
                          ? "bg-red-500"
                          : issue.severity === "high"
                            ? "bg-orange-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-sm">{issue.message}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Fix
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Commit Activity Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Commit Activity (last 12 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={commitData}>
                    <defs>
                      <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#888", fontSize: 12 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1c1c1c",
                        border: "1px solid #333",
                        borderRadius: "6px",
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="commits"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorCommits)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Documentation Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documentation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {docTypes.map((doc) => (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          doc.status === "ready"
                            ? "bg-green-500"
                            : doc.status === "pending"
                              ? "bg-yellow-500"
                              : "bg-muted-foreground/30"
                        }`}
                      />
                      <span className="font-medium text-sm">{doc.type}</span>
                      {doc.status === "ready" && (
                        <span className="text-xs text-muted-foreground">{doc.version}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.status === "ready" && (
                        <span className="text-xs text-muted-foreground">{doc.date}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => doc.status === "ready" && onNavigate("repo-docs")}
                      >
                        {doc.status === "ready" ? "View" : doc.status === "pending" ? "Pending" : "Generate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start bg-transparent"
                variant="outline"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : analysisComplete ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                    Complete!
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Generate Docs
                  </>
                )}
              </Button>
              <Button
                className="w-full justify-start bg-transparent"
                variant="outline"
                onClick={() => onNavigate("repo-metrics")}
              >
                <Eye className="w-4 h-4 mr-2" />
                Run Analysis
              </Button>
              <Button
                className="w-full justify-start bg-transparent"
                variant="outline"
                onClick={() => onNavigate("repo-docs")}
              >
                <FileText className="w-4 h-4 mr-2" />
                View Docs
              </Button>
              <Button
                className="w-full justify-start bg-transparent"
                variant="outline"
                onClick={() => onNavigate("repo-settings")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </CardContent>
          </Card>

          {/* Project Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Language</dt>
                  <dd className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    JavaScript
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">License</dt>
                  <dd className="flex items-center gap-1">
                    <Scale className="w-3 h-3" />
                    MIT
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Stars</dt>
                  <dd className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    242,537
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Forks</dt>
                  <dd className="flex items-center gap-1">
                    <GitFork className="w-3 h-3" />
                    50,467
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Default Branch</dt>
                  <dd className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    main
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd>878.9 MB</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last Push</dt>
                  <dd className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    2 hours ago
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
