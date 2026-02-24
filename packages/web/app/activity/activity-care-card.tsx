"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { Card } from "@/lib/components/ui/card";
import { Input } from "@/lib/components/ui/input";
import { cn } from "@/lib/utils";

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

  const submitWithRetry = async (mode: "add" | "set", retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 10000;
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller?.abort(), TIMEOUT_MS);

      const response = await fetch("/api/nodejs/state/allowance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          reason: reason.trim(),
          mode,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        data?: { previousMoney?: number; currentMoney?: number; delta?: number };
        message?: string;
      };

      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || `HTTP ${response.status}`);
      }

      const currentMoney = payload.data?.currentMoney ?? 0;
      const delta = payload.data?.delta ?? 0;
      const summary =
        mode === "add" ? `已发放 +${delta}，当前 ${currentMoney}` : `已设置为 ${currentMoney}`;

      setStatus({ tone: "success", message: summary });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("请求超时，请检查网络连接");
        }
        throw error;
      }

      // 网络错误重试逻辑
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return submitWithRetry(mode, retryCount + 1);
      }

      throw new Error("网络错误，请稍后重试");
    } finally {
      // 确保资源清理
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (controller) {
        controller.abort();
      }
    }
  };

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
      await submitWithRetry(mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setStatus({ tone: "error", message });
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <Card>
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[14px] font-black">轻管理 · 零花钱</h3>
          <Badge
            variant="soft"
            size="sm"
            className="border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]"
          >
            Care
          </Badge>
        </div>

        <p className="m-0 text-[13px] text-[#6b7480] leading-[1.5]">
          面向 C 端用户的"照顾悠酱"入口，风格上避免后台感。将调用接口更新零花钱。
        </p>

        <div className="grid grid-cols-2 gap-[10px] max-[520px]:grid-cols-1">
          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="money">
              金额
            </label>
            <Input
              id="money"
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
            <Input
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-[10px] items-center">
          <Button
            className="border-[rgba(145,196,238,0.55)] bg-[rgba(145,196,238,0.62)] text-[#2b2f36]"
            type="button"
            disabled={!canAdd}
            onClick={() => void submit("add")}
          >
            {activeMode === "add" ? "发放中..." : "发放（+）"}
          </Button>
          <Button type="button" disabled={!canSet} onClick={() => void submit("set")}>
            {activeMode === "set" ? "设置中..." : "设置为该值"}
          </Button>
        </div>

        {status.message ? (
          <Badge
            variant="soft"
            size="sm"
            className={cn(
              "px-[10px] py-2",
              status.tone === "error"
                ? "border-[rgba(229,88,88,0.4)] bg-[rgba(229,88,88,0.12)] text-[#b33a3a]"
                : status.tone === "success"
                  ? "border-[rgba(130,194,123,0.4)] bg-[rgba(130,194,123,0.18)] text-[#2f6b3a]"
                  : "border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.9)] text-[#6b7480]",
            )}
          >
            {status.message}
          </Badge>
        ) : (
          <Badge variant="pill" size="sm" className="border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.9)] text-[#6b7480]">
            <span>提示</span>&nbsp;<strong className="text-[#2b2f36]">发放</strong>&nbsp;
            <span>更像"给零花钱"</span>
          </Badge>
        )}
      </div>
    </Card>
  );
}
