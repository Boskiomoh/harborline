"use client";

import ThreadMessage from "@/components/tickets/thread-message";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import type {
  People,
  TicketAttachment,
  TicketEvent,
  TicketMessage,
} from "@/lib/tickets";
import {
  ArrowsClockwise,
  FileText,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC } from "react";

type Entry =
  | { kind: "message"; at: number; message: TicketMessage }
  | { kind: "event"; at: number; event: TicketEvent };

const formatSize = (bytes: number | null) => {
  if (!bytes) return null;

  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
};

const attachmentClass =
  "flex max-w-64 items-center gap-2.5 rounded-[8px] border border-border bg-surface p-1.5 pr-3 text-sm text-ink transition-colors hover:border-ink-faint";

interface TicketThreadProps {
  messages: TicketMessage[];
  events: TicketEvent[];
  attachments: TicketAttachment[];
  people: People;
  viewerId: string;
  audience: "customer" | "staff";
  serverNow: number;
  className?: string;
}

const TicketThread: FC<TicketThreadProps> = ({
  messages,
  events,
  attachments,
  people,
  viewerId,
  audience,
  serverNow,
  className,
}) => {
  const t = useTranslations();

  // Derived
  // Status changes sit in the conversation at the moment they happened.
  const entries: Entry[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      at: Date.parse(message.created_at),
      message,
    })),
    ...events.map((event) => ({
      kind: "event" as const,
      at: Date.parse(event.created_at),
      event,
    })),
  ].sort((a, b) => a.at - b.at || (a.kind === "event" ? -1 : 1));

  const filesByMessage = new Map<number, TicketAttachment[]>();
  for (const file of attachments) {
    if (file.messageId === null) continue;
    filesByMessage.set(file.messageId, [
      ...(filesByMessage.get(file.messageId) ?? []),
      file,
    ]);
  }

  return (
    <ol className={cn("grid gap-3", className)}>
      {entries.map((entry) => {
        if (entry.kind === "event") {
          const { event } = entry;
          const actor = event.changed_by ? people[event.changed_by] : undefined;
          const isOpening = event.from_status === null;
          const pill = () => (
            <StatusPill
              status={event.to_status}
              audience={audience}
              size="sm"
              className="mx-1 align-middle"
            />
          );

          return (
            <li
              key={`e${event.id}`}
              className="flex items-center gap-3 px-1 py-1.5 text-sm text-ink-soft"
            >
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-bg"
              >
                {isOpening ? (
                  <Sparkle weight="bold" className="size-3.5" />
                ) : (
                  <ArrowsClockwise weight="bold" className="size-3.5" />
                )}
              </span>
              <p className="min-w-0 flex-1 leading-7">
                {isOpening
                  ? t("timeline.opened", {
                      name:
                        actor && actor.id === viewerId
                          ? t("thread.you")
                          : (actor?.fullName ?? t("roles.customer")),
                    })
                  : actor
                    ? t.rich("timeline.changed", {
                        name:
                          actor.id === viewerId
                            ? t("thread.you")
                            : actor.fullName,
                        status: pill,
                      })
                    : t.rich("timeline.changedSystem", { status: pill })}
              </p>
              <RelativeTime
                date={event.created_at}
                serverNow={serverNow}
                className="shrink-0 font-mono text-[0.6875rem]"
              />
            </li>
          );
        }

        const { message } = entry;
        const author = message.author_id
          ? people[message.author_id]
          : undefined;
        const files = filesByMessage.get(message.id) ?? [];

        return (
          <li key={`m${message.id}`}>
            <ThreadMessage
              authorName={author?.fullName ?? t("roles.agent")}
              authorRole={author?.role ?? "agent"}
              isViewer={message.author_id === viewerId}
              internal={message.is_internal_note}
              body={message.body}
              time={
                <RelativeTime date={message.created_at} serverNow={serverNow} />
              }
            >
              {files.length > 0 && (
                <ul
                  aria-label={t("thread.attachments")}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {files.map((file) => {
                    const content = (
                      <>
                        {file.url && file.mimeType?.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                          <img
                            src={file.url}
                            alt=""
                            className="size-10 rounded-[6px] object-cover"
                          />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-[6px] bg-surface-alt text-ink-soft">
                            <FileText
                              aria-hidden
                              weight="bold"
                              className="size-5"
                            />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {file.fileName}
                          </span>
                          {formatSize(file.sizeBytes) && (
                            <span className="block font-mono text-[0.6875rem] text-ink-soft">
                              {formatSize(file.sizeBytes)}
                            </span>
                          )}
                        </span>
                      </>
                    );

                    return (
                      <li key={file.id}>
                        {file.url ? (
                          <Link
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("thread.download", {
                              name: file.fileName,
                            })}
                            className={attachmentClass}
                          >
                            {content}
                          </Link>
                        ) : (
                          <span className={attachmentClass}>{content}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ThreadMessage>
          </li>
        );
      })}
    </ol>
  );
};

export default TicketThread;
