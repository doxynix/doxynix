"use client"

import { useState } from "react"
import { Sidebar } from "@/components/prototype/sidebar"
import { Header } from "@/components/prototype/header"
import { DashboardPage } from "@/components/prototype/pages/dashboard"
import { ReposPage } from "@/components/prototype/pages/repos"
import { RepoOverviewPage } from "@/components/prototype/pages/repo-overview"
import { RepoDocsPage } from "@/components/prototype/pages/repo-docs"
import { RepoMetricsPage } from "@/components/prototype/pages/repo-metrics"
import { RepoHistoryPage } from "@/components/prototype/pages/repo-history"
import { RepoSettingsPage } from "@/components/prototype/pages/repo-settings"
import { SettingsPage } from "@/components/prototype/pages/settings"
import { RepoSetupPage } from "@/components/prototype/pages/repo-setup"
import { NotificationsPage } from "@/components/prototype/pages/notifications"
import { AddRepoModal } from "@/components/prototype/add-repo-modal"

export type Page =
  | "dashboard"
  | "repos"
  | "repo-overview"
  | "repo-docs"
  | "repo-metrics"
  | "repo-history"
  | "repo-settings"
  | "repo-setup"
  | "settings"
  | "notifications"

export type ActiveRepo = {
  owner: string
  name: string
} | null

export default function DoxynixPrototype() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [activeRepo, setActiveRepo] = useState<ActiveRepo>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const navigateToRepo = (owner: string, name: string) => {
    setActiveRepo({ owner, name })
    setCurrentPage("repo-overview")
  }

  const handleAddRepo = (owner: string, name: string) => {
    setActiveRepo({ owner, name })
    setShowAddModal(false)
    setCurrentPage("repo-setup")
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onRepoClick={navigateToRepo} onAddRepo={() => setShowAddModal(true)} />
      case "repos":
        return <ReposPage onRepoClick={navigateToRepo} onAddRepo={() => setShowAddModal(true)} />
      case "repo-setup":
        return (
          <RepoSetupPage
            repo={activeRepo}
            onNavigate={setCurrentPage}
            onBack={() => {
              setActiveRepo(null)
              setCurrentPage("dashboard")
            }}
          />
        )
      case "repo-overview":
        return <RepoOverviewPage repo={activeRepo} onNavigate={setCurrentPage} />
      case "repo-docs":
        return <RepoDocsPage repo={activeRepo} onNavigate={setCurrentPage} />
      case "repo-metrics":
        return <RepoMetricsPage repo={activeRepo} onNavigate={setCurrentPage} />
      case "repo-history":
        return <RepoHistoryPage repo={activeRepo} onNavigate={setCurrentPage} />
      case "repo-settings":
        return <RepoSettingsPage repo={activeRepo} onNavigate={setCurrentPage} />
      case "settings":
        return <SettingsPage />
      case "notifications":
        return <NotificationsPage onNavigate={setCurrentPage} onRepoClick={navigateToRepo} />
      default:
        return <DashboardPage onRepoClick={navigateToRepo} onAddRepo={() => setShowAddModal(true)} />
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="flex">
        <Sidebar
          currentPage={currentPage}
          onNavigate={(page) => {
            if (page === "dashboard" || page === "repos" || page === "settings") {
              setActiveRepo(null)
            }
            setCurrentPage(page)
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeRepo={activeRepo}
          onRepoClick={navigateToRepo}
        />
        <main className="flex-1 min-h-[calc(100vh-57px)] bg-background">{renderPage()}</main>
      </div>

      <AddRepoModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddRepo} />
    </div>
  )
}
