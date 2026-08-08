"use client";

import { useRef, type ChangeEvent, type JSX, type SyntheticEvent } from "react";
import { Paperclip, Send, Trash2 } from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { AutosizeTextarea } from "@/shared/ui/kit/autosize-textrea";

type InputProps = {
  attachments: any[];
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  input: string;
  isLoading: boolean;
  onSubmit: (e?: SyntheticEvent) => void;
  setAttachments: (v: any) => void;
  setInput: (v: string) => void;
};

export function AgentForm({
  attachments,
  handleFileChange,
  input,
  isLoading,
  onSubmit,
  setAttachments,
  setInput,
}: Readonly<InputProps>): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="w-full border-t p-4">
      {attachments.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pb-3">
          {attachments.map((file, i) => (
            <AppBadge
              key={`${file.name}-${file.size}-${file.lastModified}`}
              variant="secondary"
              className="flex items-center gap-1.5 py-1 text-xs"
            >
              <span className="max-w-30 truncate">{file.name}</span>
              <AppButton
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Delete attachment ${file.name}`}
                onClick={() => setAttachments((prev: any[]) => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive size-4 p-0"
              >
                <Trash2 />
              </AppButton>
            </AppBadge>
          ))}
        </div>
      )}

      <div className="transition-standard flex flex-col gap-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <AutosizeTextarea
          name="prompt"
          value={input}
          maxHeight={200}
          minHeight={52}
          placeholder="Ask Dxnx_..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="no-scrollbar rounded-xl"
        />

        <div className="flex items-center justify-end px-1 pt-2">
          <div className="flex items-center gap-1.5">
            <AppButton
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Upload files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip />
            </AppButton>

            <AppButton
              disabled={isLoading || !input.trim()}
              type="submit"
              size="icon"
              aria-label="Send message"
            >
              <Send />
            </AppButton>
          </div>
        </div>
      </div>
    </form>
  );
}
