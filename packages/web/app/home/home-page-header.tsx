"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { cn } from "@/lib/utils";

type HomePageHeaderProps = {
  summary?: string;
};

type MessageMetadata = {
  createdAt?: number;
};

type HomeUIMessage = UIMessage<MessageMetadata>;

const USER_NAME_KEY = "yuiju:user_name";
const DEFAULT_USER_NAME = "yixiaojiu";
const HISTORY_KEY_PREFIX = "yuiju:chat_history:";
const HISTORY_LIMIT = 20;

const getHistoryKey = (userName: string) => {
  const normalized = userName.trim() || DEFAULT_USER_NAME;
  return `${HISTORY_KEY_PREFIX}${normalized}`;
};

const formatTime = (value: number | Date = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseHistory = (raw: string | null): HomeUIMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HomeUIMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        if (typeof item.id !== "string") return null;
        if (item.role !== "user" && item.role !== "assistant") return null;
        if (!Array.isArray(item.parts)) return null;

        const parts = item.parts
          .filter((part) => part && part.type === "text" && typeof part.text === "string")
          .map((part) => ({ type: "text", text: part.text }));

        if (parts.length === 0) return null;

        const metadata =
          item.metadata && typeof item.metadata === "object" && "createdAt" in item.metadata
            ? {
                createdAt:
                  typeof item.metadata.createdAt === "number"
                    ? item.metadata.createdAt
                    : undefined,
              }
            : undefined;

        return {
          id: item.id,
          role: item.role,
          metadata,
          parts,
        } as HomeUIMessage;
      })
      .filter((item): item is HomeUIMessage => Boolean(item));
  } catch {
    return [];
  }
};

const serializeMessages = (items: HomeUIMessage[]) => {
  return items
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      id: item.id,
      role: item.role,
      metadata: item.metadata?.createdAt ? { createdAt: item.metadata.createdAt } : undefined,
      parts: item.parts
        .filter(isTextUIPart)
        .map((part) => ({ type: "text", text: part.text })),
    }))
    .filter((item) => item.parts.length > 0);
};

export function HomePageHeader({ summary }: HomePageHeaderProps) {
  const displaySummary = summary ?? "悠酱现在在【家】，正在【发呆】";
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [userName, setUserName] = useState(DEFAULT_USER_NAME);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat<HomeUIMessage>({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });

  const messageCount = messages.length;
  const isSending = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!isChatOpen) return;
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    const resolvedUserName = storedUserName?.trim() ? storedUserName.trim() : DEFAULT_USER_NAME;
    setUserName(resolvedUserName);
    setMessages(parseHistory(localStorage.getItem(getHistoryKey(resolvedUserName))));
  }, [isChatOpen, setMessages]);

  useEffect(() => {
    if (!isChatOpen) return;
    if (messageCount === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isChatOpen, messageCount]);

  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsChatOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatOpen]);

  const persistMessages = useCallback((nextMessages: HomeUIMessage[]) => {
    if (!Array.isArray(nextMessages)) {
      console.error("Invalid messages format");
      return { didTrim: false, next: [] as HomeUIMessage[] };
    }

    const serializedMessages = serializeMessages(nextMessages);
    const limitedMessages = serializedMessages.slice(-HISTORY_LIMIT);
    let finalMessages = limitedMessages;
    let didTrim = nextMessages.length > limitedMessages.length;

    try {
      const serialized = JSON.stringify(limitedMessages);
      if (serialized.length > 5120) {
        console.warn("Message data too large, truncating further");
        finalMessages = limitedMessages.slice(-Math.floor(HISTORY_LIMIT / 2));
        didTrim = true;
      }
      localStorage.setItem(getHistoryKey(userName), JSON.stringify(finalMessages));
    } catch (error) {
      console.error("Failed to persist messages:", error);
      finalMessages = limitedMessages.slice(-3);
      didTrim = true;
      try {
        localStorage.setItem(getHistoryKey(userName), JSON.stringify(finalMessages));
      } catch (e) {
        console.error("Emergency persistence failed:", e);
      }
    }

    return { didTrim, next: finalMessages };
  }, [userName]);

  useEffect(() => {
    if (!isChatOpen) return;
    const { didTrim, next } = persistMessages(messages);
    if (didTrim && next.length < messages.length) {
      setMessages(next);
    }
  }, [isChatOpen, messages, persistMessages, setMessages]);

  useEffect(() => {
    if (!error) return;
    if (lastErrorRef.current === error.message) return;
    lastErrorRef.current = error.message;
    setMessages((prev) => [
      ...prev,
      {
        id: `error-${Date.now()}`,
        role: "assistant",
        metadata: { createdAt: Date.now() },
        parts: [{ type: "text", text: `出错了：${error.message}` }],
      },
    ]);
  }, [error, setMessages]);

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setInputValue("");
    if (error) {
      clearError();
    }
    await sendMessage(
      {
        text: trimmed,
        metadata: { createdAt: Date.now() },
      },
      {
        body: { userName },
      },
    );
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleClear = () => {
    localStorage.removeItem(getHistoryKey(userName));
    setMessages([]);
  };

  const emptyHint = useMemo(() => {
    if (isSending) {
      return "悠酱思考中…";
    }
    return "现在可以开始聊天啦";
  }, [isSending]);

  return (
    <>
      <div className="flex items-end justify-between gap-[16px] mt-[18px] mb-[14px] max-[1020px]:flex-col max-[1020px]:items-start">
        <div>
          <h1 className="m-0 text-[18px] font-extrabold tracking-[0.2px]">首页</h1>
        </div>

        <div className="flex items-center gap-[10px] flex-wrap">
          <Badge variant="pill" size="default" className="whitespace-nowrap">
            <span className="text-[#6b7480]">一句话：</span>
            <strong className="text-[#2b2f36]">{displaySummary}</strong>
          </Badge>
          <Button variant="secondary" type="button" onClick={() => setIsChatOpen(true)}>
            <MessageSquare className="h-[18px] w-[18px] text-[#2b2f36]" strokeWidth={1.6} />
            手机聊天
          </Button>
        </div>
      </div>

      {isChatOpen ? (
        <div className="fixed inset-0 bg-[rgba(15,22,30,0.35)] grid items-stretch justify-items-end z-40">
          <Button
            type="button"
            variant="ghost"
            className="absolute inset-0 h-auto w-auto p-0 bg-transparent hover:bg-transparent"
            aria-label="关闭聊天抽屉"
            onClick={() => setIsChatOpen(false)}
          />
          <section
            className="relative w-[min(420px,100%)] max-[520px]:w-full h-full bg-white/95 border-l border-[rgba(217,230,245,0.9)] shadow-[-20px_0_40px_rgba(15,22,30,0.12)] grid grid-rows-[auto_1fr_auto]"
            role="dialog"
            aria-modal="true"
            aria-label="手机聊天"
          >
            <header className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-[rgba(217,230,245,0.85)]">
              <div className="grid gap-1 text-base font-black text-[#2b2f36]">
                <strong>手机聊天</strong>
                <span className="text-xs font-semibold text-[#6b7480]">@{userName}</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Badge variant="soft" size="sm">
                  {messageCount} 条
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                >
                  关闭
                </Button>
              </div>
            </header>

            <div className="px-4 py-3 grid overflow-hidden">
              <div className="grid gap-2.5 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="m-auto text-[#6b7480] text-[13px] text-center">{emptyHint}</div>
                ) : (
                  messages.map((item) => {
                    const text = item.parts
                      .filter(isTextUIPart)
                      .map((part) => part.text)
                      .join("");
                    const time = item.metadata?.createdAt
                      ? formatTime(item.metadata.createdAt)
                      : undefined;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "max-w-[82%] px-3 py-2.5 rounded-[14px] text-[13px] leading-[1.55] whitespace-pre-wrap break-words",
                          item.role === "user"
                            ? "justify-self-end bg-[rgba(145,196,238,0.22)] border border-[rgba(145,196,238,0.4)] text-[#2b2f36]"
                            : "justify-self-start bg-[rgba(247,251,255,0.94)] border border-[rgba(217,230,245,0.9)] text-[#2b2f36]",
                        )}
                      >
                        <div className="whitespace-pre-wrap">{text}</div>
                        {time ? (
                          <div className="mt-1.5 text-[11px] text-[#6b7480] text-right">
                            {time}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="border-t border-[rgba(217,230,245,0.85)] px-4 pt-3 pb-4 grid gap-2">
              <textarea
                className="w-full min-h-[80px] max-h-[160px] resize-y border border-[rgba(217,230,245,0.9)] rounded-[14px] px-3 py-2.5 text-[13px] leading-[1.5] text-[#2b2f36] bg-white/95 outline-none transition focus:border-[rgba(145,196,238,0.8)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.2)]"
                placeholder="输入内容，Enter 发送，Shift+Enter 换行"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={3}
              />
              <div className="flex items-center justify-between gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleClear}
                  disabled={messages.length === 0}
                >
                  清空
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || !inputValue.trim()}
                >
                  {isSending ? "发送中..." : "发送"}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
