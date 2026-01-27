"use client"

import { Plus, Search, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const repos = [
  { owner: "vercel", name: "next.js", status: "ready", hasDocs: true, lastAnalysis: "2 hours ago" },
  { owner: "my-org", name: "api-server", status: "pending", hasDocs: false, lastAnalysis: "1 day ago" },
  { owner: "my-org", name: "docs-site", status: "ready", hasDocs: true, lastAnalysis: "3 days ago" },
  { owner: "my-org", name: "mobile-app", status: "none", hasDocs: false, lastAnalysis: "Never" },
  { owner: "user", name: "portfolio", status: "ready", hasDocs: true, lastAnalysis: "1 week ago" },
  { owner: "user", name: "blog", status: "error", hasDocs: false, lastAnalysis: "2 days ago" },
]

interface ReposPageProps {
  onRepoClick: (owner: string, name: string) => void
  onAddRepo: () => void
}

export function ReposPage({ onRepoClick, onAddRepo }: ReposPageProps) {
  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Repositories</h1>
        <Button onClick={onAddRepo}>
          <Plus className="w-4 h-4 mr-2" />
          Add Repository
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filter repositories..." className="pl-9" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="recent">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Last Analysis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repos.map((repo) => (
              <TableRow
                key={`${repo.owner}/${repo.name}`}
                className="cursor-pointer hover:bg-accent/30"
                onClick={() => onRepoClick(repo.owner, repo.name)}
              >
                <TableCell className="font-medium">
                  {repo.owner}/{repo.name}
                </TableCell>
                <TableCell>
                  <StatusBadge status={repo.status} />
                </TableCell>
                <TableCell>
                  {repo.hasDocs ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{repo.lastAnalysis}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>Showing 6 of 12 repositories</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
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
          status === "ready"
            ? "bg-green-500"
            : status === "pending"
              ? "bg-yellow-500"
              : status === "error"
                ? "bg-red-500"
                : "bg-muted-foreground",
        )}
      />
      <span className="capitalize">{status === "none" ? "Not analyzed" : status}</span>
    </div>
  )
}
