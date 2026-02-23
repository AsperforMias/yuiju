"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./settings.module.css";

const STORAGE_KEY = "yuiju:user_name";
const DEFAULT_USER_NAME = "yixiaojiu";

export function UserNameCard() {
  const [userName, setUserName] = useState(DEFAULT_USER_NAME);
  const [storedUserName, setStoredUserName] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialValue = stored && stored.trim() ? stored : DEFAULT_USER_NAME;
    setUserName(initialValue);
    setStoredUserName(initialValue);
  }, []);

  const hasChanges = useMemo(() => {
    if (storedUserName === null) {
      return false;
    }
    return userName !== storedUserName;
  }, [storedUserName, userName]);

  const handleSave = () => {
    const nextValue = userName.trim();
    if (nextValue) {
      localStorage.setItem(STORAGE_KEY, nextValue);
      setUserName(nextValue);
      setStoredUserName(nextValue);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setUserName(DEFAULT_USER_NAME);
    setStoredUserName(DEFAULT_USER_NAME);
  };

  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-[rgba(255,255,255,0.88)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden h-full min-h-[520px]">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[24px] font-black tracking-[0.2px]">对话标识（user_name）</h3>
          <span className="inline-flex items-center px-[10px] py-2 rounded-full text-[12px] border border-[#d9e6f5] bg-white text-[#2b2f36]">
            Chat
          </span>
        </div>

        <p className="m-0 text-[15px] text-[#6b7480] leading-[1.55]">
          user_name 将用于对话时的用户标识，保存在本地浏览器的 localStorage 中。
        </p>

        <div className="grid gap-[6px]">
          <label className="text-[12px] text-[#6b7480]" htmlFor="userNameInput">
            user_name
          </label>
          <input
            id="userNameInput"
            className="w-full rounded-xl border border-[#d9e6f5] bg-[rgba(255,255,255,0.9)] px-3 py-[10px] text-[#2b2f36] outline-none transition-[border-color,box-shadow] duration-[0.16s] ease focus:border-[rgba(145,196,238,0.8)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.2)]"
            value={userName}
            onChange={(event) => {
              setUserName(event.target.value);
            }}
          />
        </div>

        <div className="flex items-center gap-[10px]">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-[rgba(145,196,238,0.55)] bg-[rgba(145,196,238,0.62)] px-3 py-[10px] text-[#2b2f36] disabled:opacity-[0.55] disabled:cursor-not-allowed"
            type="button"
            disabled={!hasChanges}
            onClick={handleSave}
          >
            保存
          </button>
          <span className="text-[12px] text-[#6b7480]">
            {hasChanges ? "有未保存的修改" : "已同步到本地"}
          </span>
        </div>
      </div>
    </section>
  );
}
