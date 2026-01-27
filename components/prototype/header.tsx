"use client"

import { useState } from "react"
import { Search, HelpCircle, Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "./theme-toggle"

export function Header() {
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  return (
    <header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background font-bold text-sm">D</span>
          </div>
          <span className="font-semibold text-lg">Doxynix</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 h-9 bg-muted/50 border-border"
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          />
          {showSearch && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg p-2">
              <p className="text-sm text-muted-foreground p-2">Type to search repositories...</p>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground px-2 mb-1">Recent</p>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">vercel/next.js</button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">
                  my-org/api-server
                </button>
              </div>
            </div>
          )}
        </div>

        <ThemeToggle />

        {/* Help */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setShowHelp(!showHelp)}>
            <HelpCircle className="w-5 h-5" />
          </Button>
          {showHelp && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-background border border-border rounded-md shadow-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Help & Resources</p>
                <button onClick={() => setShowHelp(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-1">
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">Documentation</button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">API Reference</button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">
                  Contact Support
                </button>
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded">
                  Keyboard Shortcuts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>
          {showNotifications && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-background border border-border rounded-md shadow-lg">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <p className="font-medium text-sm">Notifications</p>
                <button className="text-xs text-primary hover:underline">Mark all read</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-3 hover:bg-accent/50 border-b border-border">
                  <p className="text-sm font-medium">Analysis completed</p>
                  <p className="text-xs text-muted-foreground">vercel/next.js - 2 hours ago</p>
                </div>
                <div className="p-3 hover:bg-accent/50 border-b border-border">
                  <p className="text-sm font-medium">New docs available</p>
                  <p className="text-xs text-muted-foreground">my-org/api-server - 1 day ago</p>
                </div>
                <div className="p-3 hover:bg-accent/50">
                  <p className="text-sm font-medium">Analysis failed</p>
                  <p className="text-xs text-muted-foreground">user/blog - 2 days ago</p>
                </div>
              </div>
              <div className="p-2 border-t border-border">
                <button className="w-full text-center text-sm text-primary hover:underline py-1">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center ml-2 hover:ring-2 hover:ring-ring transition-all"
            onClick={() => setShowProfile(!showProfile)}
          >
            <span className="text-xs font-medium">U</span>
          </button>
          {showProfile && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-background border border-border rounded-md shadow-lg py-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="font-medium text-sm">John Doe</p>
                <p className="text-xs text-muted-foreground">john@example.com</p>
              </div>
              <div className="py-1">
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">Your Profile</button>
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">Settings</button>
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">API Keys</button>
              </div>
              <div className="border-t border-border py-1">
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-destructive">
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
