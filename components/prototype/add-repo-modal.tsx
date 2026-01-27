"use client"

import { useState } from "react"
import { X, Github, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AddRepoModalProps {
  open: boolean
  onClose: () => void
  onAdd: (owner: string, name: string) => void
}

export function AddRepoModal({ open, onClose, onAdd }: AddRepoModalProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = () => {
    if (!query.trim()) return
    setLoading(true)

    // Имитация загрузки
    setTimeout(() => {
      // Парсим owner/name из URL или строки
      const parts = query.replace("https://github.com/", "").split("/")
      const owner = parts[0] || "user"
      const name = parts[1] || query
      setLoading(false)
      onAdd(owner, name)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Add Repository</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Repository URL or name</label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="owner/repo or https://github.com/..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Enter the repository URL or owner/name format</p>
          </div>

          {/* Quick search results (заглушка) */}
          {query.length > 2 && !loading && (
            <div className="border border-border rounded-md divide-y divide-border">
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
                onClick={() => {
                  setQuery("vercel/ai")
                }}
              >
                <Github className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">vercel/ai</p>
                  <p className="text-xs text-muted-foreground">Build AI-powered applications</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
                onClick={() => {
                  setQuery("vercel/next.js")
                }}
              >
                <Github className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">vercel/next.js</p>
                  <p className="text-xs text-muted-foreground">The React Framework</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!query.trim() || loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
