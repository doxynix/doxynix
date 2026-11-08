"use client";

import {
  type ChangeEvent,
  type Dispatch,
  type JSX,
  type SetStateAction,
  type SyntheticEvent,
  useRef,
} from "react";
import { FileText, Paperclip, Send, Square, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/core/attachment";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/shared/ui/core/input-group";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { AutosizeTextarea } from "@/shared/ui/kit/autosize-textrea";

import type { LocalFileAttachment } from "../model/agent-types";

type InputProps = {
  attachments: LocalFileAttachment[];
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  input: string;
  isLoading: boolean;
  onStop: () => void;
  onSubmit: (e?: SyntheticEvent) => void;
  setAttachments: Dispatch<SetStateAction<LocalFileAttachment[]>>;
  setInput: (v: string) => void;
};

export function AgentForm({
  attachments,
  handleFileChange,
  input,
  isLoading,
  onStop,
  onSubmit,
  setAttachments,
  setInput,
}: Readonly<InputProps>): JSX.Element {
  const t = useTranslations("Agent");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="w-full border-t p-4"
      onSubmit={onSubmit}
    >
      <input
        className="hidden"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      <InputGroup className="flex-col">
        {attachments.length > 0 && (
          <InputGroupAddon
            align="block-start"
            className="flex-wrap"
          >
            {attachments.map((file, i) => (
              <Attachment
                className="min-w-0"
                key={file.url}
                size="sm"
              >
                <AttachmentMedia>
                  <FileText />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{file.name}</AttachmentTitle>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={t("delete_attachment", { name: file.name })}
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    type="button"
                  >
                    <Trash2 />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
          </InputGroupAddon>
        )}

        <AutosizeTextarea
          className="no-scrollbar flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2 text-base shadow-none ring-0 placeholder:text-muted-foreground focus-visible:ring-0 md:text-sm dark:bg-transparent"
          data-slot="input-group-control"
          maxHeight={200}
          minHeight={52}
          name="prompt"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isLoading) {
                return;
              }
              onSubmit();
            }
          }}
          placeholder={t("input_placeholder")}
          value={input}
        />

        <InputGroupAddon
          align="block-end"
          className="justify-end gap-1.5"
        >
          <InputGroupButton
            aria-label={t("upload_files")}
            onClick={() => fileInputRef.current?.click()}
            size="icon-sm"
            variant="ghost"
          >
            <Paperclip />
          </InputGroupButton>

          <AppTooltip content={isLoading ? t("stop_response") : t("send_message")}>
            <InputGroupButton
              aria-label={isLoading ? t("stop_response") : t("send_message")}
              disabled={!isLoading && !input.trim() && attachments.length === 0}
              onClick={isLoading ? onStop : undefined}
              size="icon-sm"
              type={isLoading ? "button" : "submit"}
            >
              {isLoading ? <Square /> : <Send />}
            </InputGroupButton>
          </AppTooltip>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
