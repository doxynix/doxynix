"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RepoTabs } from "../repo-tabs"
import type { Page, ActiveRepo } from "@/app/page"
import {
  ExternalLink,
  ChevronRight,
  ChevronDown,
  FileText,
  Code,
  BookOpen,
  History,
  Download,
  Share2,
  RefreshCw,
  Copy,
  Check,
  Folder,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RepoDocsPageProps {
  repo: ActiveRepo
  onNavigate: (page: Page) => void
}

const docTypes = [
  { id: "readme", label: "README", icon: FileText },
  { id: "api", label: "API Docs", icon: Code },
  { id: "guide", label: "User Guide", icon: BookOpen },
  { id: "changelog", label: "Changelog", icon: History },
  { id: "code", label: "Code Docs", icon: Code },
]

const versions = [
  { id: "v2.1", label: "v2.1 (latest)", date: "Jan 27, 2026" },
  { id: "v2.0", label: "v2.0", date: "Jan 15, 2026" },
  { id: "v1.9", label: "v1.9", date: "Dec 28, 2025" },
  { id: "v1.8", label: "v1.8", date: "Dec 10, 2025" },
]

const docNavigation = [
  {
    title: "Getting Started",
    icon: Folder,
    items: [
      { id: "overview", label: "Overview" },
      { id: "installation", label: "Installation" },
      { id: "quick-start", label: "Quick Start" },
    ],
  },
  {
    title: "Core Concepts",
    icon: Folder,
    items: [
      { id: "components", label: "Components" },
      { id: "jsx", label: "JSX" },
      { id: "props", label: "Props" },
      { id: "state", label: "State" },
    ],
  },
  {
    title: "Hooks",
    icon: Folder,
    items: [
      { id: "usestate", label: "useState" },
      { id: "useeffect", label: "useEffect" },
      { id: "usecontext", label: "useContext" },
      { id: "custom-hooks", label: "Custom Hooks" },
    ],
  },
  {
    title: "Advanced",
    icon: Folder,
    items: [
      { id: "performance", label: "Performance" },
      { id: "testing", label: "Testing" },
      { id: "ssr", label: "Server-Side Rendering" },
    ],
  },
]

const docContents: Record<string, { title: string; body: string }> = {
  overview: {
    title: "Overview",
    body: `React is a JavaScript library for building user interfaces.

React lets you build user interfaces out of individual pieces called components. Create your own React components like Thumbnail, LikeButton, and Video. Then combine them into entire screens, pages, and apps.

Key Features:
• Component-Based - Build encapsulated components that manage their own state
• Declarative - Design simple views for each state in your application
• Learn Once, Write Anywhere - Develop new features without rewriting existing code

Whether you work on your own or with thousands of other developers, using React feels the same.`,
  },
  installation: {
    title: "Installation",
    body: `You can install React using npm, yarn, or pnpm.

Using npm:
npm install react react-dom

Using yarn:
yarn add react react-dom

Using pnpm:
pnpm add react react-dom

Requirements:
• Node.js 18.17 or later
• macOS, Windows (including WSL), and Linux are supported

TypeScript Support:
React has built-in TypeScript support. Install the types:
npm install @types/react @types/react-dom`,
  },
  "quick-start": {
    title: "Quick Start",
    body: `Welcome to the React documentation! This page will give you an introduction to the 80% of React concepts that you will use on a daily basis.

Creating a Component:
React components are JavaScript functions that return markup:

function MyButton() {
  return (
    <button>I'm a button</button>
  );
}

Now that you've declared MyButton, you can nest it into another component:

export default function MyApp() {
  return (
    <div>
      <h1>Welcome to my app</h1>
      <MyButton />
    </div>
  );
}

Adding Styles:
In React, you specify a CSS class with className:
<img className="avatar" />`,
  },
  components: {
    title: "Components",
    body: `Components are the building blocks of React applications. A component is a piece of the UI that has its own logic and appearance.

Function Components:
The simplest way to define a component is to write a JavaScript function:

function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

Component Composition:
Components can refer to other components in their output. This lets us use the same component abstraction for any level of detail.

Best Practices:
• Keep components small and focused
• Use meaningful names
• Extract reusable logic into custom hooks`,
  },
  jsx: {
    title: "JSX",
    body: `JSX is a syntax extension for JavaScript that lets you write HTML-like markup inside a JavaScript file.

Why JSX?
React embraces the fact that rendering logic is inherently coupled with other UI logic: how events are handled, how the state changes over time, and how the data is prepared for display.

JSX Rules:
1. Return a single root element
2. Close all tags
3. Use camelCase for most attributes

Embedding Expressions:
You can embed any JavaScript expression in JSX by wrapping it in curly braces:

const name = 'Josh Perez';
const element = <h1>Hello, {name}</h1>;`,
  },
}

export function RepoDocsPage({ repo, onNavigate }: RepoDocsPageProps) {
  const [selectedDocType, setSelectedDocType] = useState("readme")
  const [selectedVersion, setSelectedVersion] = useState("v2.1")
  const [selectedSection, setSelectedSection] = useState("overview")
  const [expandedSections, setExpandedSections] = useState<string[]>(["Getting Started", "Core Concepts", "Hooks"])
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [showDocTypeDropdown, setShowDocTypeDropdown] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!repo) return null

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((s) => s !== title) : [...prev, title]
    )
  }

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allItems = docNavigation.flatMap((s) => s.items)
  const currentIndex = allItems.findIndex((i) => i.id === selectedSection)
  const currentContent = docContents[selectedSection] || docContents.overview

  return (
    <div className="p-6 max-w-7xl">
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
      <RepoTabs currentTab="docs" onNavigate={onNavigate} />

      {/* Doc Type and Version Selectors */}
      <div className="flex flex-wrap items-center gap-3 mt-6 pb-4 border-b border-border">
        {/* Doc Type Selector */}
        <div className="relative">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => {
              setShowDocTypeDropdown(!showDocTypeDropdown)
              setShowVersionDropdown(false)
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            {docTypes.find((d) => d.id === selectedDocType)?.label || "README"}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          {showDocTypeDropdown && (
            <Card className="absolute top-full left-0 mt-1 w-48 p-1 z-10">
              {docTypes.map((doc) => {
                const Icon = doc.icon
                return (
                  <button
                    key={doc.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                    onClick={() => {
                      setSelectedDocType(doc.id)
                      setShowDocTypeDropdown(false)
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {doc.label}
                  </button>
                )
              })}
            </Card>
          )}
        </div>

        {/* Version Selector */}
        <div className="relative">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => {
              setShowVersionDropdown(!showVersionDropdown)
              setShowDocTypeDropdown(false)
            }}
          >
            <History className="w-4 h-4 mr-2" />
            {versions.find((v) => v.id === selectedVersion)?.label || "v2.1 (latest)"}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          {showVersionDropdown && (
            <Card className="absolute top-full left-0 mt-1 w-56 p-1 z-10">
              {versions.map((version) => (
                <button
                  key={version.id}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                  onClick={() => {
                    setSelectedVersion(version.id)
                    setShowVersionDropdown(false)
                  }}
                >
                  <span>{version.label}</span>
                  <span className="text-muted-foreground text-xs">{version.date}</span>
                </button>
              ))}
            </Card>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <Button variant="outline" size="sm" className="bg-transparent">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="sm" className="bg-transparent">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 mt-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-4 sticky top-24">
            <nav className="space-y-2">
              {docNavigation.map((section) => {
                const Icon = section.icon
                return (
                  <div key={section.title}>
                    <button
                      className="w-full flex items-center gap-2 text-sm font-medium py-1.5 hover:text-foreground transition-colors"
                      onClick={() => toggleSection(section.title)}
                    >
                      {expandedSections.includes(section.title) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span>{section.title}</span>
                    </button>
                    {expandedSections.includes(section.title) && (
                      <div className="space-y-0.5 ml-6 mt-1 border-l border-border pl-3">
                        {section.items.map((item) => (
                          <button
                            key={item.id}
                            className={cn(
                              "w-full text-left text-sm py-1.5 px-2 rounded transition-colors",
                              selectedSection === item.id
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                            onClick={() => setSelectedSection(item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            {/* Copy button */}
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h1 className="text-2xl font-bold mb-6">{currentContent.title}</h1>
              <div className="space-y-4 text-muted-foreground leading-relaxed whitespace-pre-line">
                {currentContent.body}
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="bg-transparent"
                disabled={currentIndex === 0}
                onClick={() => {
                  if (currentIndex > 0) {
                    setSelectedSection(allItems[currentIndex - 1].id)
                  }
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Generated: 2h ago | {selectedVersion} | 48 pages
              </span>
              <Button
                variant="outline"
                className="bg-transparent"
                disabled={currentIndex === allItems.length - 1}
                onClick={() => {
                  if (currentIndex < allItems.length - 1) {
                    setSelectedSection(allItems[currentIndex + 1].id)
                  }
                }}
              >
                Next
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
