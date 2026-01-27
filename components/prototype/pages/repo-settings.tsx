"use client"

import { useState } from "react"
import { Save, Trash2, RefreshCw, ExternalLink, Bell, Clock, FileText, GitBranch, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"
import { cn } from "@/lib/utils"

interface RepoSettingsPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

const scheduleOptions = [
  { id: "manual", label: "Manual only" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
]

const docTypeOptions = [
  { id: "readme", label: "README", enabled: true },
  { id: "api", label: "API Docs", enabled: true },
  { id: "guide", label: "User Guide", enabled: false },
  { id: "changelog", label: "Changelog", enabled: true },
  { id: "code", label: "Code Docs", enabled: false },
]

export function RepoSettingsPage({ repo, onNavigate }: RepoSettingsPageProps) {
  const [selectedSchedule, setSelectedSchedule] = useState("weekly")
  const [docTypes, setDocTypes] = useState(docTypeOptions)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!repo) return null

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1500)
  }

  const toggleDocType = (id: string) => {
    setDocTypes((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, enabled: !doc.enabled } : doc))
    )
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
      <RepoTabs currentTab="settings" onNavigate={onNavigate} />

      <div className="mt-6 grid md:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                General Settings
              </CardTitle>
              <CardDescription>Configure basic repository options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Default Branch</Label>
                  <Input id="branch" defaultValue="main" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Primary Language</Label>
                  <Input id="language" defaultValue="JavaScript" disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description Override</Label>
                <Input
                  id="description"
                  placeholder="Leave empty to use GitHub description"
                  defaultValue=""
                />
                <p className="text-xs text-muted-foreground">
                  Override the repository description used in documentation
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Documentation Types */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documentation Types
              </CardTitle>
              <CardDescription>Choose which documentation types to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {docTypes.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer",
                      doc.enabled
                        ? "bg-accent/30 border-accent"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                    onClick={() => toggleDocType(doc.id)}
                  >
                    <span className="font-medium text-sm">{doc.label}</span>
                    <Switch checked={doc.enabled} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Analysis Settings
              </CardTitle>
              <CardDescription>Configure how documentation is generated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Auto-analyze on push</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically run analysis when new commits are pushed
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Include private files</Label>
                  <p className="text-sm text-muted-foreground">Analyze files marked as private or internal</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Deep analysis mode</Label>
                  <p className="text-sm text-muted-foreground">More thorough analysis (uses more tokens)</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Exclude Patterns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Exclude Patterns
              </CardTitle>
              <CardDescription>Files and folders matching these patterns will be ignored</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patterns">Patterns (one per line)</Label>
                <textarea
                  id="patterns"
                  className="w-full h-32 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  defaultValue={`node_modules/
.git/
dist/
build/
*.lock
*.log
.env*
__tests__/
coverage/`}
                />
              </div>
              <Button variant="outline" size="sm" className="bg-transparent">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to defaults
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Schedule
              </CardTitle>
              <CardDescription>Auto-regenerate documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scheduleOptions.map((option) => (
                  <div
                    key={option.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer",
                      selectedSchedule === option.id
                        ? "bg-accent/30 border-accent"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedSchedule(option.id)}
                  >
                    <span className="text-sm">{option.label}</span>
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 transition-colors",
                        selectedSchedule === option.id
                          ? "border-foreground bg-foreground"
                          : "border-muted-foreground"
                      )}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </CardTitle>
              <CardDescription>Get notified about this repo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Analysis complete</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Analysis failed</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">New version detected</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Weekly summary</span>
                <Switch />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>

          {/* Danger Zone */}
          <Card className="border-red-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-red-500">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Are you sure? This will delete all documentation.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent border-red-500/30 text-red-500 hover:bg-red-500/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Repository
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
