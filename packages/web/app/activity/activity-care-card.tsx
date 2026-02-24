"use client";

import { useMemo, useState } from "react";

type CareStatus = {
  tone: "idle" | "loading" | "success" | "error";
  message: string;
};

const parseAmount = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export function ActivityCareCard() {
  const [amountInput, setAmountInput] = useState("20");
  const [reason, setReason] = useState("奖励今天努力学习");
  const [status, setStatus] = useState<CareStatus>({ tone: "idle", message: "" });
  const [activeMode, setActiveMode] = useState<"add" | "set" | null>(null);

  const amountValue = useMemo(() => parseAmount(amountInput), [amountInput]);
  const isSubmitting = activeMode !== null;

  const canAdd = amountValue !== null && amountValue > 0 && !isSubmitting;
  const canSet = amountValue !== null && amountValue >= 0 && !isSubmitting;

  const submit = async (mode: "add" | "set") => {
    if (isSubmitting) return;
    if (amountValue === null) {
      setStatus({ tone: "error", message: "请输入整数金额" });
      return;
    }
    if (mode === "add" && amountValue <= 0) {
      setStatus({ tone: "error", message: "发放金额需大于 0" });
      return;
    }
    if (mode === "set" && amountValue < 0) {
      setStatus({ tone: "error", message: "设置金额需大于等于 0" });
      return;
    }

    setActiveMode(mode);
    setStatus({ tone: "loading", message: "提交中..." });

    try {
      const response = await fetch("/api/nodejs/state/allowance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          reason: reason.trim(),
          mode,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        data?: { previousMoney?: number; currentMoney?: number; delta?: number };
        message?: string;
      };

      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "请求失败");
      }

      const currentMoney = payload.data?.currentMoney ?? 0;
      const delta = payload.data?.delta ?? 0;
      const summary =
        mode === "add"
          ? `已发放 +${delta}，当前 ${currentMoney}`
          : `已设置为 ${currentMoney}`;

      setStatus({ tone: "success", message: summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setStatus({ tone: "error", message });
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-[rgba(255,255,255,0.88)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">轻管理 · 零花钱</h3>
          <span className="inline-flex items-center gap-[6px] px-[10px] py-2 rounded-full text-[12px] border border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]">
            Care
          </span>
        </div>

        <p className="m-0 text-[13px] text-[#6b7480] leading-[1.5]">
          面向 C 端用户的"照顾悠酱"入口，风格上避免后台感。将调用接口更新零花钱。
        </p>

        <div className="grid grid-cols-2 gap-[10px] max-[520px]:grid-cols-1">
          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="money">
              金额
            </label>
            <input
              id="money"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              type="number"
              min={0}
              step={1}
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
            />
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="reason">
              原因（可选）
            </label>
            <input
              id="reason"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-[10px] items-center">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(145,196,238,0.55)] bg-[rgba(145,196,238,0.62)] px-3 py-[10px] transition-[160ms] ease disabled:opacity-[0.55] disabled:cursor-not-allowed text-[#2b2f36]"
            type="button"
            disabled={!canAdd}
            onClick={() => void submit("add")}
          >
            {activeMode === "add" ? "发放中..." : "发放（+）"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9e6f5] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] transition-[160ms] ease disabled:opacity-[0.55] disabled:cursor-not-allowed text-[#2b2f36]"
            type="button"
            disabled={!canSet}
            onClick={() => void submit("set")}
          >
            {activeMode === "set" ? "设置中..." : "设置为该值"}
          </button>
        </div>

        {status.message ? (
          <div
            className={`inline-flex items-center gap-2 px-[10px] py-2 rounded-full text-[12px] border ${
              status.tone === "error"
                ? "border-[rgba(229,88,88,0.4)] bg-[rgba(229,88,88,0.12)] text-[#b33a3a]"
                : status.tone === "success"
                  ? "border-[rgba(130,194,123,0.4)] bg-[rgba(130,194,123,0.18)] text-[#2f6b3a]"
                  : "border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.9)] text-[#6b7480]"
            }`}
          >
            <span>{status.message}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-[10px] py-2 rounded-full text-[12px] border border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.9)] text-[#6b7480]">
            <span>提示</span>&nbsp;<strong className="text-[#2b2f36]">发放</strong>&nbsp;
            <span>更像"给零花钱"</span>
          </div>
        )}
      </div>
    </section>
  );
}
