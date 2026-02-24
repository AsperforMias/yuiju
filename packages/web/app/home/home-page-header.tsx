"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { cn } from "@/lib/utils";

type HomePageHeaderProps = {
  summary?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time?: string;
};

const USER_NAME_KEY = "yuiju:user_name";
const DEFAULT_USER_NAME = "yixiaojiu";
const HISTORY_KEY_PREFIX = "yuiju:chat_history:";
const HISTORY_LIMIT = 20;

const getHistoryKey = (userName: string) => {
  const normalized = userName.trim() || DEFAULT_USER_NAME;
  return `${HISTORY_KEY_PREFIX}${normalized}`;
};

const formatTime = (date = new Date()) => {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseHistory = (raw: string | null): ChatMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && typeof item.content === "string" && typeof item.role === "string",
    );
  } catch {
    return [];
  }
};

export function HomePageHeader({ summary }: HomePageHeaderProps) {
  const displaySummary = summary ?? "悠酱现在在【家】，正在【发呆】";
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [userName, setUserName] = useState(DEFAULT_USER_NAME);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageCount = messages.length;

  useEffect(() => {
    if (!isChatOpen) return;
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    const resolvedUserName = storedUserName?.trim() ? storedUserName.trim() : DEFAULT_USER_NAME;
    setUserName(resolvedUserName);
    setMessages(parseHistory(localStorage.getItem(getHistoryKey(resolvedUserName))));
  }, [isChatOpen]);

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

  const persistMessages = (nextMessages: ChatMessage[]) => {
    // 数据验证和截断
    if (!Array.isArray(nextMessages)) {
      console.error("Invalid messages format");
      return;
    }
    
    // 限制历史记录数量，防止localStorage溢出
    const truncatedMessages = nextMessages.slice(-HISTORY_LIMIT);
    
    // 验证消息格式
    const validMessages = truncatedMessages.filter(
      (item) => item && typeof item.content === "string" && typeof item.role === "string"
    );
    
    // 检查总数据大小（约5KB限制）
    try {
      const serialized = JSON.stringify(validMessages);
      if (serialized.length > 5120) { // 5KB限制
        console.warn("Message data too large, truncating further");
        const furtherTruncated = validMessages.slice(-Math.floor(HISTORY_LIMIT / 2));
        localStorage.setItem(getHistoryKey(userName), JSON.stringify(furtherTruncated));
        setMessages(furtherTruncated);
      } else {
        localStorage.setItem(getHistoryKey(userName), serialized);
        setMessages(validMessages);
      }
    } catch (error) {
      console.error("Failed to persist messages:", error);
      // 降级处理：只保留最新消息
      const emergencyMessages = validMessages.slice(-3);
      try {
        localStorage.setItem(getHistoryKey(userName), JSON.stringify(emergencyMessages));
        setMessages(emergencyMessages);
      } catch (e) {
        console.error("Emergency persistence failed:", e);
        setMessages([]);
      }
    }
  };

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const historyPayload = messages.slice(-HISTORY_LIMIT).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      time: formatTime(),
    };

    const nextMessages = [...messages, userMessage];
    persistMessages(nextMessages);
    setInputValue("");
    setIsSending(true);

    try {
      const response = await fetch("/api/nodejs/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          userName,
          history: historyPayload,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        data?: { reply?: string };
        message?: string;
      };

      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "请求失败");
      }

      const reply = payload.data?.reply?.trim() || "呜…这句话我一时没理解呢。";
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply,
        time: formatTime(),
      };

      persistMessages([...nextMessages, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `出错了：${message}`,
        time: formatTime(),
      };

      persistMessages([...nextMessages, assistantMessage]);
    } finally {
      setIsSending(false);
    }
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
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 18.5h7.2c3.7 0 6.3-2.4 6.3-5.8S17.9 7 14.2 7H9.8C6.1 7 3.5 9.4 3.5 12.7c0 1.8.8 3.4 2.2 4.5L5 21l4-2.5Z"
                stroke="rgba(43,47,54,0.9)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            手机聊天
          </Button>
        </div>
      </div>

      {isChatOpen ? (
        <div className="fixed inset-0 bg-[rgba(15,22,30,0.35)] grid items-stretch justify-items-end z-40">
          <button
            type="button"
            className="absolute inset-0"
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
                  messages.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "max-w-[82%] px-3 py-2.5 rounded-[14px] text-[13px] leading-[1.55] whitespace-pre-wrap break-words",
                        item.role === "user"
                          ? "justify-self-end bg-[rgba(145,196,238,0.22)] border border-[rgba(145,196,238,0.4)] text-[#2b2f36]"
                          : "justify-self-start bg-[rgba(247,251,255,0.94)] border border-[rgba(217,230,245,0.9)] text-[#2b2f36]",
                      )}
                    >
                      <div className="whitespace-pre-wrap">{item.content}</div>
                      {item.time ? (
                        <div className="mt-1.5 text-[11px] text-[#6b7480] text-right">
                          {item.time}
                        </div>
                      ) : null}
                    </div>
                  ))
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
