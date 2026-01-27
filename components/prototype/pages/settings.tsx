"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { User, Link, Key, CreditCard, AlertTriangle, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react"

const settingsTabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "integrations", label: "Integrations", icon: Link },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [showApiKey, setShowApiKey] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium mb-1">Profile</h2>
              <p className="text-sm text-muted-foreground">Manage your account settings</p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Avatar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xl font-medium">U</span>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      Upload new
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" defaultValue="John Doe" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john@example.com" />
                </div>
                <Button size="sm">Save Changes</Button>
              </CardContent>
            </Card>
          </div>
        )

      case "integrations":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium mb-1">Integrations</h2>
              <p className="text-sm text-muted-foreground">Connect external services</p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">GitHub</CardTitle>
                <CardDescription>Connected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="font-medium">U</span>
                    </div>
                    <div>
                      <p className="font-medium">@username</p>
                      <p className="text-sm text-muted-foreground">Connected on Dec 1, 2025</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked disabled className="w-4 h-4 rounded" />
                  <span className="text-sm">Read access to repositories</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked disabled className="w-4 h-4 rounded" />
                  <span className="text-sm">Read access to metadata</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm">Write access (for auto-commit docs)</span>
                </label>
                <Button size="sm" className="mt-2">
                  Update Permissions
                </Button>
              </CardContent>
            </Card>
          </div>
        )

      case "api-keys":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-medium mb-1">API Keys</h2>
                <p className="text-sm text-muted-foreground">Manage your API access tokens</p>
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <div className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Production Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">
                          {showApiKey ? "dx_live_a1b2c3d4e5f6g7h8i9j0" : "dx_live_••••••••••••••••"}
                        </code>
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Created Dec 15, 2025 · Last used 2 hours ago</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Development Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">dx_test_••••••••••••••••</code>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Created Dec 10, 2025 · Last used 5 days ago</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "billing":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium mb-1">Billing</h2>
              <p className="text-sm text-muted-foreground">Manage your subscription and payments</p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">Free</p>
                    <p className="text-sm text-muted-foreground">5 repositories · 10 analyses/month</p>
                  </div>
                  <Button>Upgrade to Pro</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Repositories</span>
                    <span>3 / 5</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "60%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Analyses</span>
                    <span>7 / 10</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "70%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No payment method added</p>
                <Button variant="outline" size="sm" className="mt-3 bg-transparent">
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          </div>
        )

      case "danger":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium mb-1 text-destructive">Danger Zone</h2>
              <p className="text-sm text-muted-foreground">Irreversible and destructive actions</p>
            </div>

            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Export Data</CardTitle>
                <CardDescription>Download all your data including documentation and settings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm">
                  Export All Data
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Delete All Repositories</CardTitle>
                <CardDescription>Remove all connected repositories and generated documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm">
                  Delete All Repositories
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Delete Account</CardTitle>
                <CardDescription>Permanently delete your account and all associated data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="flex gap-8">
        {/* Settings Nav */}
        <nav className="w-48 space-y-1">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                tab.id === "danger" && "text-destructive hover:text-destructive",
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="flex-1">{renderContent()}</div>
      </div>
    </div>
  )
}
