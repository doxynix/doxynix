"use client"

import type React from "react"

import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRightIcon,
  FileCode,
  Folder,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RepoTabs } from "../repo-tabs"
import { cn } from "@/lib/utils"
import type { Page, ActiveRepo } from "@/app/page"

const docTree = [
  {
    title: "Getting Started",
    icon: Folder,
    items: ["Overview", "Installation", "Quick Start"],
  },
  {
    title: "API",
    icon: Folder,
    items: ["Routes", "Middleware", "Auth"],
  },
  {
    title: "Components",
    icon: Folder,
    items: ["Button", "Card", "Modal", "Form"],
  },
  {
    title: "Utilities",
    icon: Folder,
    items: ["Helpers", "Hooks", "Types"],
  },
]

const docContent: Record<string, { title: string; content: React.ReactNode }> = {
  Overview: {
    title: "Getting Started",
    content: (
      <>
        <p>
          Next.js is a React framework for building full-stack web applications. You use React Components to build user
          interfaces, and Next.js for additional features and optimizations.
        </p>
        <h2>Why Next.js?</h2>
        <ul>
          <li>Built-in optimizations for images, fonts, and scripts</li>
          <li>Server-side rendering and static generation</li>
          <li>File-based routing with dynamic routes</li>
          <li>API routes for backend functionality</li>
        </ul>
      </>
    ),
  },
  Installation: {
    title: "Installation",
    content: (
      <>
        <p>To create a new Next.js project, run the following command:</p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">npx create-next-app@latest</div>
        <p>This will prompt you to configure your project. After installation, you can start the development server:</p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">npm run dev</div>
      </>
    ),
  },
  "Quick Start": {
    title: "Quick Start",
    content: (
      <>
        <h2>Project Structure</h2>
        <p>The generated project includes:</p>
        <ul>
          <li>
            <code>/app</code> - App Router pages
          </li>
          <li>
            <code>/public</code> - Static assets
          </li>
          <li>
            <code>/components</code> - React components
          </li>
        </ul>
        <h2>Creating Your First Page</h2>
        <p>
          Create a file at <code>app/page.tsx</code> to define your home page.
        </p>
      </>
    ),
  },
  Routes: {
    title: "API Routes",
    content: (
      <>
        <p>API Routes allow you to create API endpoints inside your Next.js application.</p>
        <h2>Creating an API Route</h2>
        <p>
          Create a file at <code>app/api/hello/route.ts</code>:
        </p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">
          {`export async function GET() {
  return Response.json({ message: 'Hello World' })
}`}
        </div>
      </>
    ),
  },
  Middleware: {
    title: "Middleware",
    content: (
      <>
        <p>Middleware allows you to run code before a request is completed.</p>
        <h2>Creating Middleware</h2>
        <p>
          Create a <code>middleware.ts</code> file in your project root.
        </p>
      </>
    ),
  },
  Auth: {
    title: "Authentication",
    content: (
      <>
        <p>Implement authentication in your Next.js application.</p>
        <h2>Options</h2>
        <ul>
          <li>NextAuth.js - Complete authentication solution</li>
          <li>Clerk - Drop-in authentication</li>
          <li>Custom JWT implementation</li>
        </ul>
      </>
    ),
  },
  Button: {
    title: "Button Component",
    content: (
      <>
        <p>A versatile button component with multiple variants.</p>
        <h2>Usage</h2>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">{`<Button variant="primary">Click me</Button>`}</div>
        <h2>Props</h2>
        <ul>
          <li>
            <code>variant</code> - primary, secondary, outline, ghost
          </li>
          <li>
            <code>size</code> - sm, md, lg
          </li>
          <li>
            <code>disabled</code> - boolean
          </li>
        </ul>
      </>
    ),
  },
  Card: {
    title: "Card Component",
    content: (
      <>
        <p>A container component for grouping related content.</p>
        <h2>Usage</h2>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">{`<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content here</CardContent>
</Card>`}</div>
      </>
    ),
  },
  Modal: {
    title: "Modal Component",
    content: (
      <>
        <p>A dialog component for displaying content in an overlay.</p>
        <h2>Usage</h2>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">{`<Modal open={isOpen} onClose={handleClose}>
  <ModalContent>Your content</ModalContent>
</Modal>`}</div>
      </>
    ),
  },
  Form: {
    title: "Form Component",
    content: (
      <>
        <p>Form components with built-in validation.</p>
        <h2>Features</h2>
        <ul>
          <li>Zod schema validation</li>
          <li>React Hook Form integration</li>
          <li>Accessible error messages</li>
        </ul>
      </>
    ),
  },
  Helpers: {
    title: "Helper Functions",
    content: (
      <>
        <p>Utility functions used throughout the application.</p>
        <h2>cn()</h2>
        <p>A utility for conditionally joining class names.</p>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">{`import { cn } from '@/lib/utils'

cn('base-class', isActive && 'active-class')`}</div>
      </>
    ),
  },
  Hooks: {
    title: "Custom Hooks",
    content: (
      <>
        <p>Reusable React hooks for common functionality.</p>
        <h2>useDebounce</h2>
        <p>Debounces a value with a specified delay.</p>
        <h2>useLocalStorage</h2>
        <p>Persists state to localStorage.</p>
      </>
    ),
  },
  Types: {
    title: "TypeScript Types",
    content: (
      <>
        <p>Type definitions used in the project.</p>
        <h2>Common Types</h2>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm my-4">{`type User = {
  id: string
  name: string
  email: string
}`}</div>
      </>
    ),
  },
}

interface RepoDocsPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

export function RepoDocsPage({ repo, onNavigate }: RepoDocsPageProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["Getting Started"])
  const [activeItem, setActiveItem] = useState("Overview")

  if (!repo) return null

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]))
  }

  const allItems = docTree.flatMap((section) => section.items)
  const currentIndex = allItems.indexOf(activeItem)
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

  const currentContent = docContent[activeItem] || {
    title: activeItem,
    content: <p>Documentation for {activeItem}.</p>,
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
      <RepoTabs currentTab="docs" onNavigate={onNavigate} />

      {/* Docs Layout */}
      <div className="flex gap-6 mt-6">
        {/* Doc Sidebar */}
        <aside className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {docTree.map((section) => (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-accent/50 rounded-md"
                >
                  {expandedSections.includes(section.title) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <section.icon className="w-4 h-4 text-muted-foreground" />
                  {section.title}
                </button>
                {expandedSections.includes(section.title) && (
                  <div className="ml-4 space-y-0.5">
                    {section.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => setActiveItem(item)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2",
                          activeItem === item
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        )}
                      >
                        <FileCode className="w-3 h-3" />
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="border-t border-border mt-6 pt-4 space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </aside>

        {/* Doc Content */}
        <div className="flex-1 min-w-0">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <h1>{currentContent.title}</h1>
            {currentContent.content}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button variant="outline" disabled={!prevItem} onClick={() => prevItem && setActiveItem(prevItem)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              {prevItem || "Previous"}
            </Button>
            <Button variant="outline" disabled={!nextItem} onClick={() => nextItem && setActiveItem(nextItem)}>
              {nextItem || "Next"}
              <ChevronRightIcon className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
