"use client";

import { type ChangeEvent, type JSX, type SyntheticEvent, useRef } from "react";
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
    <form className="w-full border-t p-4" onSubmit={onSubmit}>
      {attachments.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pb-3">
          {attachments.map((file, i) => (
            <AppBadge
              className="flex items-center gap-1.5 py-1 text-xs"
              key={`${file.name}-${file.size}-${file.lastModified}`}
              variant="secondary"
            >
              <span className="max-w-30 truncate">{file.name}</span>
              <AppButton
                aria-label={`Delete attachment ${file.name}`}
                className="size-4 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setAttachments((prev: any[]) => prev.filter((_, idx) => idx !== i))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </AppButton>
            </AppBadge>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 transition-standard">
        <input
          className="hidden"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />

        <AutosizeTextarea
          className="no-scrollbar rounded-xl"
          maxHeight={200}
          minHeight={52}
          name="prompt"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask Dxnx_..."
          value={input}
        />

        <div className="flex items-center justify-end px-1 pt-2">
          <div className="flex items-center gap-1.5">
            <AppButton
              aria-label="Upload files"
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Paperclip />
            </AppButton>

            <AppButton
              aria-label="Send message"
              disabled={isLoading || !input.trim()}
              size="icon"
              type="submit"
            >
              <Send />
            </AppButton>
          </div>
        </div>
      </div>
    </form>
  );
}
