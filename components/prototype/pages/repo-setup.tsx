"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  FileJson,
  FileText,
  Check,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Page, ActiveRepo } from "@/app/page"

// Дерево файлов (заглушка)
const fileTree = [
  {
    name: "src",
    type: "folder",
    checked: true,
    expanded: true,
    children: [
      {
        name: "components",
        type: "folder",
        checked: true,
        children: [
          { name: "Button.tsx", type: "file", checked: true },
          { name: "Card.tsx", type: "file", checked: true },
          { name: "Modal.tsx", type: "file", checked: true },
        ],
      },
      {
        name: "utils",
        type: "folder",
        checked: true,
        children: [
          { name: "helpers.ts", type: "file", checked: true },
          { name: "api.ts", type: "file", checked: true },
        ],
      },
      { name: "app.tsx", type: "file", checked: true },
      { name: "index.tsx", type: "file", checked: true },
    ],
  },
  {
    name: "public",
    type: "folder",
    checked: false,
    children: [
      { name: "favicon.ico", type: "file", checked: false },
      { name: "robots.txt", type: "file", checked: false },
    ],
  },
  {
    name: "node_modules",
    type: "folder",
    checked: false,
    excluded: true,
    children: [],
  },
  {
    name: ".git",
    type: "folder",
    checked: false,
    excluded: true,
    children: [],
  },
  { name: "package.json", type: "file", checked: false, excluded: true },
  { name: "package-lock.json", type: "file", checked: false, excluded: true },
  { name: "tsconfig.json", type: "file", checked: true },
  { name: "README.md", type: "file", checked: true },
]

const defaultExcludes = ["node_modules", ".git", "*.lock", "*.log", "dist", "build", ".env*"]

interface RepoSetupPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
  onBack: () => void
}

export function RepoSetupPage({ repo, onNavigate, onBack }: RepoSetupPageProps) {
  const [excludePattern, setExcludePattern] = useState("")
  const [excludes, setExcludes] = useState(defaultExcludes)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<string[]>(["src", "src/components", "src/utils"])

  const addExclude = () => {
    if (excludePattern.trim() && !excludes.includes(excludePattern.trim())) {
      setExcludes([...excludes, excludePattern.trim()])
      setExcludePattern("")
    }
  }

  const removeExclude = (pattern: string) => {
    setExcludes(excludes.filter((e) => e !== pattern))
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  const startAnalysis = () => {
    setIsAnalyzing(true)
    setTimeout(() => {
      setIsAnalyzing(false)
      onNavigate("repo-overview")
    }, 2000)
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Configure Analysis</h1>
        <p className="text-muted-foreground">
          {repo?.owner}/{repo?.name} — Select files and folders to include in documentation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Tree */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Files & Folders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Check the files you want to analyze. Grayed out items are excluded by patterns.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-md p-3 max-h-[400px] overflow-y-auto bg-muted/20">
              {fileTree.map((item) => (
                <FileTreeItem
                  key={item.name}
                  item={item}
                  depth={0}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  excludes={excludes}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exclude Patterns */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exclude Patterns</CardTitle>
              <p className="text-sm text-muted-foreground">Files matching these patterns will be skipped</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="e.g. *.test.ts"
                  value={excludePattern}
                  onChange={(e) => setExcludePattern(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExclude()}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addExclude}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {excludes.map((pattern) => (
                  <span
                    key={pattern}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-md group"
                  >
                    <code>{pattern}</code>
                    <button
                      onClick={() => removeExclude(pattern)}
                      className="text-muted-foreground hover:text-foreground ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Branch Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <select className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background">
                <option>main</option>
                <option>develop</option>
                <option>feature/docs</option>
              </select>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Files selected</span>
                  <span className="font-medium">24 files</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated time</span>
                  <span className="font-medium">~2-3 min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-medium">~45,000</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action */}
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={startAnalysis} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Start Analysis
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

interface FileTreeItemProps {
  item: any
  depth: number
  path?: string
  expandedFolders: string[]
  onToggleFolder: (path: string) => void
  excludes: string[]
}

function FileTreeItem({ item, depth, path = "", expandedFolders, onToggleFolder, excludes }: FileTreeItemProps) {
  const fullPath = path ? `${path}/${item.name}` : item.name
  const isFolder = item.type === "folder"
  const isExpanded = expandedFolders.includes(fullPath)
  const isExcluded =
    item.excluded ||
    excludes.some((e) => {
      if (e.startsWith("*.")) return item.name.endsWith(e.slice(1))
      return item.name === e || item.name.includes(e)
    })

  const getIcon = () => {
    if (isFolder) return Folder
    if (item.name.endsWith(".json")) return FileJson
    if (item.name.endsWith(".md") || item.name.endsWith(".txt")) return FileText
    return FileCode
  }

  const Icon = getIcon()

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors",
          isExcluded && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse for folders */}
        {isFolder ? (
          <button onClick={() => onToggleFolder(fullPath)} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.checked && !isExcluded}
          disabled={isExcluded}
          onChange={() => {}}
          className="rounded border-border"
        />

        {/* Icon */}
        <Icon className={cn("w-4 h-4", isFolder ? "text-blue-500" : "text-muted-foreground")} />

        {/* Name */}
        <span className={cn("text-sm", isExcluded && "line-through")}>{item.name}</span>

        {/* Excluded badge */}
        {isExcluded && <span className="text-xs text-muted-foreground ml-auto">excluded</span>}
      </div>

      {/* Children */}
      {isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child: any) => (
            <FileTreeItem
              key={child.name}
              item={child}
              depth={depth + 1}
              path={fullPath}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              excludes={excludes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
