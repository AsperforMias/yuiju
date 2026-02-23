"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../home.module.css";

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
    return parsed.filter((item) => item && typeof item.content === "string" && typeof item.role === "string");
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

  useEffect(() => {
    if (!isChatOpen) return;
    const storedUserName = localStorage.getItem(USER_NAME_KEY);
    const resolvedUserName = storedUserName?.trim() ? storedUserName.trim() : DEFAULT_USER_NAME;
    setUserName(resolvedUserName);
    setMessages(parseHistory(localStorage.getItem(getHistoryKey(resolvedUserName))));
  }, [isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isChatOpen, messages]);

  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsChatOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatOpen]);

  const messageCount = messages.length;

  const persistMessages = (nextMessages: ChatMessage[]) => {
    setMessages(nextMessages);
    localStorage.setItem(getHistoryKey(userName), JSON.stringify(nextMessages));
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
      <div className="flex items-end justify-between gap-[16px] mt-[18px] mb-[14px]">
        <div>
          <h1 className="m-0 text-[18px] font-extrabold tracking-[0.2px]">首页</h1>
        </div>

        <div className="flex items-center gap-[10px] flex-wrap">
          <div className={styles["home-pill"]}>
            <span className={styles["home-muted"]}>一句话：</span>
            <strong>{displaySummary}</strong>
          </div>
          <button
            className={`${styles["home-btn"]} ${styles["home-btn-secondary"]}`}
            type="button"
            onClick={() => setIsChatOpen(true)}
          >
            <svg className={styles["home-icon"]} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 18.5h7.2c3.7 0 6.3-2.4 6.3-5.8S17.9 7 14.2 7H9.8C6.1 7 3.5 9.4 3.5 12.7c0 1.8.8 3.4 2.2 4.5L5 21l4-2.5Z"
                stroke="rgba(43,47,54,0.9)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            手机聊天
          </button>
        </div>
      </div>

      {isChatOpen ? (
        <div
          className={styles["home-chat-overlay"]}
          onClick={() => setIsChatOpen(false)}
          role="presentation"
        >
          <section
            className={styles["home-chat-drawer"]}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="手机聊天"
          >
            <header className={styles["home-chat-header"]}>
              <div className={styles["home-chat-title"]}>
                <strong>手机聊天</strong>
                <span className={styles["home-chat-subtitle"]}>@{userName}</span>
              </div>
              <div className={styles["home-chat-header-actions"]}>
                <span className={styles["home-chat-pill"]}>{messageCount} 条</span>
                <button
                  className={styles["home-chat-close"]}
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                >
                  关闭
                </button>
              </div>
            </header>

            <div className={styles["home-chat-body"]}>
              <div className={styles["home-chat-messages"]}>
                {messages.length === 0 ? (
                  <div className={styles["home-chat-empty"]}>{emptyHint}</div>
                ) : (
                  messages.map((item) => (
                    <div
                      key={item.id}
                      className={`${styles["home-chat-bubble"]} ${
                        item.role === "user"
                          ? styles["home-chat-bubble-user"]
                          : styles["home-chat-bubble-assistant"]
                      }`}
                    >
                      <div className={styles["home-chat-text"]}>{item.content}</div>
                      {item.time ? (
                        <div className={styles["home-chat-time"]}>{item.time}</div>
                      ) : null}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className={styles["home-chat-footer"]}>
              <textarea
                className={styles["home-chat-input"]}
                placeholder="输入内容，Enter 发送，Shift+Enter 换行"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={3}
              />
              <div className={styles["home-chat-actions"]}>
                <button
                  className={styles["home-chat-clear"]}
                  type="button"
                  onClick={handleClear}
                  disabled={messages.length === 0}
                >
                  清空
                </button>
                <button
                  className={styles["home-chat-send"]}
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || !inputValue.trim()}
                >
                  {isSending ? "发送中..." : "发送"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
