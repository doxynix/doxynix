"use client"

import { useState } from "react"
import { Play, Loader2, FileText, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RepoTabs } from "../repo-tabs"
import { cn } from "@/lib/utils"
import type { Page, ActiveRepo } from "@/app/page"

const analysisHistory = [
  { id: 24, status: "success", date: "Dec 27, 14:30", version: "v14.2.0", duration: "2m 34s", files: 1247, pages: 48 },
  { id: 23, status: "success", date: "Dec 25, 10:15", version: "v14.1.0", duration: "2m 12s", files: 1203, pages: 45 },
  { id: 22, status: "failed", date: "Dec 22, 09:00", version: "v14.1.0", duration: "0m 45s", files: 0, pages: 0 },
  { id: 21, status: "success", date: "Dec 20, 16:45", version: "v14.0.0", duration: "3m 01s", files: 1189, pages: 44 },
  { id: 20, status: "success", date: "Dec 15, 11:30", version: "v14.0.0", duration: "2m 58s", files: 1150, pages: 42 },
]

interface RepoAnalysisPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

export function RepoAnalysisPage({ repo, onNavigate }: RepoAnalysisPageProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<(typeof analysisHistory)[0] | null>(analysisHistory[0])
  const [isRunning, setIsRunning] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  if (!repo) return null

  const handleRunNew = () => {
    setIsRunning(true)
    setTimeout(() => {
      setIsRunning(false)
      setSelectedAnalysis({
        id: 25,
        status: "success",
        date: "Just now",
        version: "v14.2.1",
        duration: "2m 15s",
        files: 1250,
        pages: 49,
      })
    }, 2500)
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <span>{repo.owner}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{repo.name}</span>
      </div>

      {/* Tabs */}
      <RepoTabs currentTab="analysis" onNavigate={onNavigate} />

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Analysis History</h2>
          <Button onClick={handleRunNew} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run New
              </>
            )}
          </Button>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysisHistory.map((analysis) => (
                <TableRow
                  key={analysis.id}
                  className={cn(
                    "cursor-pointer hover:bg-accent/30",
                    selectedAnalysis?.id === analysis.id && "bg-accent/50",
                  )}
                  onClick={() => setSelectedAnalysis(analysis)}
                >
                  <TableCell className="text-muted-foreground">{analysis.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          analysis.status === "success" ? "bg-green-500" : "bg-red-500",
                        )}
                      />
                      <span className="capitalize">{analysis.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>{analysis.date}</TableCell>
                  <TableCell>{analysis.version}</TableCell>
                  <TableCell className="text-muted-foreground">{analysis.duration}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Selected Analysis Details */}
        {selectedAnalysis && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Analysis #{selectedAnalysis.id} Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        selectedAnalysis.status === "success" ? "bg-green-500" : "bg-red-500",
                      )}
                    />
                    <span className="capitalize">{selectedAnalysis.status}</span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{selectedAnalysis.date}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd>{selectedAnalysis.duration}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Files analyzed</dt>
                  <dd>{selectedAnalysis.files.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Docs generated</dt>
                  <dd>{selectedAnalysis.pages} pages</dd>
                </div>
              </dl>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("repo-docs")}
                  disabled={selectedAnalysis.status === "failed"}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Generated Docs
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
                  <Terminal className="w-4 h-4 mr-2" />
                  {showLogs ? "Hide Logs" : "View Logs"}
                </Button>
              </div>

              {showLogs && (
                <div className="mt-4 p-3 bg-muted/50 rounded-md font-mono text-xs overflow-x-auto">
                  <div className="text-green-500">[14:30:12] Starting analysis...</div>
                  <div className="text-muted-foreground">[14:30:13] Fetching repository metadata</div>
                  <div className="text-muted-foreground">[14:30:15] Cloning repository (branch: main)</div>
                  <div className="text-muted-foreground">[14:30:28] Scanning files... found 1,247 files</div>
                  <div className="text-muted-foreground">[14:30:45] Analyzing TypeScript files...</div>
                  <div className="text-muted-foreground">[14:31:30] Generating documentation structure</div>
                  <div className="text-muted-foreground">[14:32:15] Writing 48 documentation pages</div>
                  {selectedAnalysis.status === "success" ? (
                    <div className="text-green-500">[14:32:46] Analysis completed successfully!</div>
                  ) : (
                    <div className="text-red-500">[14:30:45] Error: Failed to parse source files</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
