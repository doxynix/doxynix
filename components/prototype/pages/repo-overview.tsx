"use client"

import { useState } from "react"
import { Play, FileText, ExternalLink, Star, GitFork, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"

interface RepoOverviewPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

export function RepoOverviewPage({ repo, onNavigate }: RepoOverviewPageProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<number | null>(null)

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

  const analyses = [
    { id: 24, status: "success", date: "2 hours ago", version: "14.2.0" },
    { id: 23, status: "success", date: "2 days ago", version: "14.1.0" },
    { id: 22, status: "failed", date: "5 days ago", version: "14.1.0" },
  ]

  return (
    <div className="p-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <span>{repo.owner}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{repo.name}</span>
      </div>

      {/* Tabs */}
      <RepoTabs currentTab="overview" onNavigate={onNavigate} />

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Left Column */}
        <div className="md:col-span-2 space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium">Documentation Ready</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Last updated: 2 hours ago</p>
                <p>Version: v14.2.0</p>
              </div>
            </CardContent>
          </Card>

          {/* Repo Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Repository Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="text-right max-w-xs">The React Framework for the Web</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Language</dt>
                  <dd>TypeScript (78%)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Stars</dt>
                  <dd className="flex items-center gap-1">
                    <Star className="w-3 h-3" /> 120,543
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Forks</dt>
                  <dd className="flex items-center gap-1">
                    <GitFork className="w-3 h-3" /> 25,891
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">License</dt>
                  <dd>MIT</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Recent Analysis History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Analysis History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className={`flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-accent/30 -mx-2 px-2 rounded ${selectedAnalysis === analysis.id ? "bg-accent/50" : ""}`}
                  onClick={() => setSelectedAnalysis(selectedAnalysis === analysis.id ? null : analysis.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">#{analysis.id}</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          analysis.status === "success" ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="capitalize">{analysis.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{analysis.date}</span>
                    <span>v{analysis.version}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigate("repo-analysis")
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}

              {selectedAnalysis && (
                <div className="mt-3 p-3 bg-muted/50 rounded-md text-sm">
                  <p className="font-medium mb-2">Analysis #{selectedAnalysis} Details</p>
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Files analyzed:</dt>
                      <dd>1,247</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Docs generated:</dt>
                      <dd>48 pages</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Duration:</dt>
                      <dd>2m 34s</dd>
                    </div>
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions */}
        <div>
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
                    Run Analysis
                  </>
                )}
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
                onClick={() => window.open(`https://github.com/${repo.owner}/${repo.name}`, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open on GitHub
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
