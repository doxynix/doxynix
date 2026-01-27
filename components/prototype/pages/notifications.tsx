"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Page, ActiveRepo } from "@/app/page"
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  FileText,
  GitBranch,
  Settings,
  Trash2,
  Filter,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NotificationsPageProps {
  onNavigate: (page: Page) => void
  onRepoClick: (owner: string, name: string) => void
}

type NotificationType = "all" | "success" | "warning" | "error" | "info"

const notifications = [
  {
    id: 1,
    type: "success",
    title: "Documentation generated successfully",
    message: "README, API Docs, and User Guide have been generated for vercel/next.js",
    repo: { owner: "vercel", name: "next.js" },
    time: "2 hours ago",
    read: false,
  },
  {
    id: 2,
    type: "warning",
    title: "High Bus Factor detected",
    message: "facebook/react has a bus factor of 1. Consider adding more contributors.",
    repo: { owner: "facebook", name: "react" },
    time: "5 hours ago",
    read: false,
  },
  {
    id: 3,
    type: "error",
    title: "Analysis failed",
    message: "Rate limit exceeded for my-org/api-server. Try again in 1 hour.",
    repo: { owner: "my-org", name: "api-server" },
    time: "1 day ago",
    read: true,
  },
  {
    id: 4,
    type: "info",
    title: "New version available",
    message: "A new version of docs has been detected for vercel/next.js (v15.0.0)",
    repo: { owner: "vercel", name: "next.js" },
    time: "1 day ago",
    read: true,
  },
  {
    id: 5,
    type: "success",
    title: "Scheduled analysis complete",
    message: "Weekly analysis for my-org/docs-site completed successfully.",
    repo: { owner: "my-org", name: "docs-site" },
    time: "2 days ago",
    read: true,
  },
  {
    id: 6,
    type: "warning",
    title: "Documentation outdated",
    message: "The documentation for user/portfolio is 30 days old. Consider regenerating.",
    repo: { owner: "user", name: "portfolio" },
    time: "3 days ago",
    read: true,
  },
  {
    id: 7,
    type: "info",
    title: "Repository added",
    message: "vercel/ai has been added to your repositories.",
    repo: { owner: "vercel", name: "ai" },
    time: "5 days ago",
    read: true,
  },
  {
    id: 8,
    type: "success",
    title: "API Docs updated",
    message: "API documentation for my-org/api-server has been updated to v2.3.0",
    repo: { owner: "my-org", name: "api-server" },
    time: "1 week ago",
    read: true,
  },
]

const filterOptions = [
  { id: "all", label: "All", icon: Bell },
  { id: "success", label: "Success", icon: Check },
  { id: "warning", label: "Warnings", icon: AlertTriangle },
  { id: "error", label: "Errors", icon: AlertTriangle },
  { id: "info", label: "Info", icon: FileText },
]

export function NotificationsPage({ onNavigate, onRepoClick }: NotificationsPageProps) {
  const [filter, setFilter] = useState<NotificationType>("all")
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [notificationList, setNotificationList] = useState(notifications)

  const filteredNotifications =
    filter === "all" ? notificationList : notificationList.filter((n) => n.type === filter)

  const unreadCount = notificationList.filter((n) => !n.read).length

  const markAllAsRead = () => {
    setNotificationList((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const markAsRead = (id: number) => {
    setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const deleteNotification = (id: number) => {
    setNotificationList((prev) => prev.filter((n) => n.id !== id))
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <Check className="w-4 h-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "info":
        return <FileText className="w-4 h-4 text-blue-500" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20"
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20"
      case "error":
        return "bg-red-500/10 border-red-500/20"
      case "info":
        return "bg-blue-500/10 border-blue-500/20"
      default:
        return "bg-muted"
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">{unreadCount}</span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Stay updated with your repository activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-transparent" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate("settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {filterOptions.find((f) => f.id === filter)?.label || "All"}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          {showFilterDropdown && (
            <Card className="absolute top-full left-0 mt-1 w-40 p-1 z-10">
              {filterOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors",
                      filter === option.id && "bg-muted"
                    )}
                    onClick={() => {
                      setFilter(option.id as NotificationType)
                      setShowFilterDropdown(false)
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                )
              })}
            </Card>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{filteredNotifications.length} notifications</span>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "p-4 border transition-colors hover:bg-muted/30 cursor-pointer",
                !notification.read && "border-l-2 border-l-blue-500",
                getTypeBg(notification.type)
              )}
              onClick={() => {
                markAsRead(notification.id)
                onRepoClick(notification.repo.owner, notification.repo.name)
              }}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5">{getTypeIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("font-medium text-sm", !notification.read && "text-foreground")}>
                      {notification.title}
                    </span>
                    {!notification.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {notification.repo.owner}/{notification.repo.name}
                    </span>
                    <span>{notification.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        markAsRead(notification.id)
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notification.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredNotifications.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline" className="bg-transparent">
            Load older notifications
          </Button>
        </div>
      )}
    </div>
  )
}
