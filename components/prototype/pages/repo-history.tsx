"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"
import {
  ExternalLink,
  Play,
  Check,
  X,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Loader2,
} from "lucide-react"

interface RepoHistoryPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

const analysisHistory = [
  {
    id: 47,
    type: "Full",
    status: "success",
    date: "Jan 27, 14:30",
    docsGenerated: 5,
    totalDocs: 5,
    duration: "3m 24s",
    branch: "main",
    commit: "a1b2c3d",
    filesAnalyzed: 1247,
    tokensUsed: 45230,
  },
  {
    id: 46,
    type: "README",
    status: "success",
    date: "Jan 25, 10:15",
    docsGenerated: 1,
    totalDocs: 5,
    duration: "0m 45s",
    branch: "main",
    commit: "b2c3d4e",
    filesAnalyzed: 312,
    tokensUsed: 12450,
  },
  {
    id: 45,
    type: "Full",
    status: "failed",
    date: "Jan 22, 09:00",
    docsGenerated: 0,
    totalDocs: 5,
    duration: "1m 12s",
    branch: "main",
    commit: "c3d4e5f",
    filesAnalyzed: 0,
    tokensUsed: 0,
    error: "Rate limit exceeded. Please try again later.",
  },
  {
    id: 44,
    type: "API Docs",
    status: "success",
    date: "Jan 20, 16:45",
    docsGenerated: 1,
    totalDocs: 5,
    duration: "1m 58s",
    branch: "main",
    commit: "d4e5f6g",
    filesAnalyzed: 589,
    tokensUsed: 23100,
  },
  {
    id: 43,
    type: "Full",
    status: "success",
    date: "Jan 15, 11:30",
    docsGenerated: 5,
    totalDocs: 5,
    duration: "3m 01s",
    branch: "main",
    commit: "e5f6g7h",
    filesAnalyzed: 1198,
    tokensUsed: 42800,
  },
]

export function RepoHistoryPage({ repo, onNavigate }: RepoHistoryPageProps) {
  const [expandedId, setExpandedId] = useState<number | null>(47)
  const [isRunning, setIsRunning] = useState(false)

  if (!repo) return null

  const handleRunNew = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 2000)
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
      <RepoTabs currentTab="history" onNavigate={onNavigate} />

      {/* History Content */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Analysis History</h2>
          <Button onClick={handleRunNew} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run New Analysis
              </>
            )}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">#</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Docs</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {analysisHistory.map((analysis) => (
                    <>
                      <tr
                        key={analysis.id}
                        className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${
                          expandedId === analysis.id ? "bg-muted/30" : ""
                        }`}
                        onClick={() => setExpandedId(expandedId === analysis.id ? null : analysis.id)}
                      >
                        <td className="p-4 text-sm">{analysis.id}</td>
                        <td className="p-4 text-sm">
                          <span className="px-2 py-1 bg-muted rounded text-xs">{analysis.type}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {analysis.status === "success" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm text-green-500">Success</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm text-red-500">Failed</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{analysis.date}</td>
                        <td className="p-4 text-sm">
                          {analysis.docsGenerated}/{analysis.totalDocs}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{analysis.duration}</td>
                        <td className="p-4">
                          {expandedId === analysis.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </td>
                      </tr>
                      {expandedId === analysis.id && (
                        <tr key={`${analysis.id}-details`} className="bg-muted/20">
                          <td colSpan={7} className="p-4">
                            <div className="space-y-4">
                              <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm">Analysis Details</h4>
                                  <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <dt className="text-muted-foreground">Branch</dt>
                                      <dd className="font-mono">{analysis.branch}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-muted-foreground">Commit</dt>
                                      <dd className="font-mono">{analysis.commit}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-muted-foreground">Files Analyzed</dt>
                                      <dd>{analysis.filesAnalyzed.toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-muted-foreground">Tokens Used</dt>
                                      <dd>{analysis.tokensUsed.toLocaleString()}</dd>
                                    </div>
                                  </dl>
                                </div>
                                {analysis.status === "failed" && analysis.error && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-red-500">Error</h4>
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm">
                                      {analysis.error}
                                    </div>
                                  </div>
                                )}
                                {analysis.status === "success" && (
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm">Generated Documents</h4>
                                    <div className="space-y-1">
                                      {["README", "API Docs", "User Guide", "Changelog", "Code Docs"]
                                        .slice(0, analysis.docsGenerated)
                                        .map((doc) => (
                                          <div key={doc} className="flex items-center gap-2 text-sm">
                                            <Check className="w-4 h-4 text-green-500" />
                                            <span>{doc}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-border">
                                {analysis.status === "success" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-transparent"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onNavigate("repo-docs")
                                      }}
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      View Docs
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-transparent"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Export
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-transparent"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Re-run
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
