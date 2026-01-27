"use client"

import { Save, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"

interface RepoSettingsPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

export function RepoSettingsPage({ repo, onNavigate }: RepoSettingsPageProps) {
  if (!repo) return null

  return (
    <div className="p-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <span>{repo.owner}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{repo.name}</span>
      </div>

      {/* Tabs */}
      <RepoTabs currentTab="settings" onNavigate={onNavigate} />

      <div className="mt-6 space-y-6 max-w-2xl">
        {/* Analysis Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Settings</CardTitle>
            <CardDescription>Configure how documentation is generated for this repository</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input id="branch" defaultValue="main" className="max-w-xs" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-analyze on push</Label>
                <p className="text-sm text-muted-foreground">Automatically run analysis when new commits are pushed</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include private files</Label>
                <p className="text-sm text-muted-foreground">Analyze files marked as private or internal</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Exclude Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exclude Patterns</CardTitle>
            <CardDescription>Files and folders matching these patterns will be ignored</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patterns">Patterns (one per line)</Label>
              <textarea
                id="patterns"
                className="w-full h-32 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={`node_modules/
.git/
dist/
*.lock
*.log
.env*`}
              />
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset to defaults
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle className="text-base text-red-500">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions for this repository</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium">Remove repository</p>
                <p className="text-sm text-muted-foreground">
                  Delete all generated documentation and remove from Doxynix
                </p>
              </div>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
