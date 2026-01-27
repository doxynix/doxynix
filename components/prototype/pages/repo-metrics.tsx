"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"
import { ExternalLink, AlertTriangle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface RepoMetricsPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

const languageData = [
  { name: "JavaScript", value: 58, color: "#f7df1e" },
  { name: "TypeScript", value: 32, color: "#3178c6" },
  { name: "CSS", value: 6, color: "#563d7c" },
  { name: "Other", value: 4, color: "#6b7280" },
]

const commitActivityData = [
  { month: "Jan", additions: 1200, deletions: 400 },
  { month: "Feb", additions: 1800, deletions: 600 },
  { month: "Mar", additions: 2400, deletions: 900 },
  { month: "Apr", additions: 1600, deletions: 500 },
  { month: "May", additions: 3200, deletions: 1200 },
  { month: "Jun", additions: 2800, deletions: 800 },
  { month: "Jul", additions: 2100, deletions: 700 },
  { month: "Aug", additions: 2600, deletions: 900 },
  { month: "Sep", additions: 3400, deletions: 1100 },
  { month: "Oct", additions: 2900, deletions: 950 },
  { month: "Nov", additions: 2200, deletions: 750 },
  { month: "Dec", additions: 2700, deletions: 850 },
]

const contributors = [
  { name: "dan_abramov", commits: 5234, percentage: 42 },
  { name: "gaearon", commits: 2156, percentage: 17 },
  { name: "acdlite", commits: 1823, percentage: 15 },
  { name: "sebmarkbage", commits: 1102, percentage: 9 },
  { name: "sophiebits", commits: 891, percentage: 7 },
]

const prMetrics = [
  { week: "W1", opened: 12, merged: 8, closed: 2 },
  { week: "W2", opened: 15, merged: 12, closed: 1 },
  { week: "W3", opened: 8, merged: 10, closed: 3 },
  { week: "W4", opened: 18, merged: 14, closed: 2 },
]

export function RepoMetricsPage({ repo, onNavigate }: RepoMetricsPageProps) {
  if (!repo) return null

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
      <RepoTabs currentTab="metrics" onNavigate={onNavigate} />

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Languages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {languageData.map((lang) => (
                  <div key={lang.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.color }} />
                    <span className="text-sm flex-1">{lang.name}</span>
                    <span className="text-sm text-muted-foreground">{lang.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Language Bar */}
            <div className="mt-4 h-2 rounded-full overflow-hidden flex">
              {languageData.map((lang) => (
                <div
                  key={lang.name}
                  className="h-full"
                  style={{ width: `${lang.value}%`, backgroundColor: lang.color }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Code Complexity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Code Complexity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold text-yellow-500">12.4</div>
                <div className="text-xs text-muted-foreground">Cyclomatic (Medium)</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold text-green-500">B+</div>
                <div className="text-xs text-muted-foreground">Maintainability</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold">~24h</div>
                <div className="text-xs text-muted-foreground">Tech Debt</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-md">
                <div className="text-2xl font-bold text-blue-500">3.2%</div>
                <div className="text-xs text-muted-foreground">Duplications</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commit Activity */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Commit Activity
              <span className="text-xs font-normal text-muted-foreground">(Additions vs Deletions)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commitActivityData} barGap={0}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#888", fontSize: 12 }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1c1c",
                      border: "1px solid #333",
                      borderRadius: "6px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="additions" fill="#22c55e" radius={[4, 4, 0, 0]} name="Additions" />
                  <Bar dataKey="deletions" fill="#ef4444" radius={[4, 4, 0, 0]} name="Deletions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Additions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Deletions</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bus Factor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Bus Factor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md mb-4">
              <div className="flex items-center gap-2 text-yellow-500 font-medium">
                <AlertTriangle className="w-4 h-4" />
                RISK: High
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Top 1 contributor made <span className="text-foreground font-medium">67%</span> of all commits
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                If this person leaves, project may be at risk.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PR Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">PR Metrics (Last 4 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prMetrics}>
                  <XAxis
                    dataKey="week"
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
                  <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="merged" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <div className="text-lg font-bold">4.2h</div>
                <div className="text-xs text-muted-foreground">Avg merge time</div>
              </div>
              <div>
                <div className="text-lg font-bold">23</div>
                <div className="text-xs text-muted-foreground">Open PRs</div>
              </div>
              <div>
                <div className="text-lg font-bold">156</div>
                <div className="text-xs text-muted-foreground">Merged (month)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Contributors */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Top Contributors
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contributors.map((contributor, index) => (
                <div key={contributor.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{contributor.name}</div>
                    <div className="text-xs text-muted-foreground">{contributor.commits.toLocaleString()} commits</div>
                  </div>
                  <div className="w-32">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${contributor.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-12 text-right">{contributor.percentage}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
