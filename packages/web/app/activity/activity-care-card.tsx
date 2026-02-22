import styles from "./activity.module.css";

export function ActivityCareCard() {
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
          面向 C 端用户的"照顾悠酱"入口，风格上避免后台感。此处仅展示 UI，不执行真实操作。
        </p>

        <div className="grid grid-cols-2 gap-[10px] max-[520px]:grid-cols-1">
          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="money">
              金额
            </label>
            <input
              id="money"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              defaultValue="20"
              disabled
            />
          </div>

          <div className="grid gap-[6px]">
            <label className="text-[12px] text-[#6b7480]" htmlFor="reason">
              原因（可选）
            </label>
            <input
              id="reason"
              className="w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] text-[#2b2f36]"
              defaultValue="奖励今天努力学习"
              disabled
            />
          </div>
        </div>

        <div className="flex gap-[10px] items-center">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(145,196,238,0.55)] bg-[rgba(145,196,238,0.62)] px-3 py-[10px] transition-[160ms] ease disabled:opacity-[0.55] disabled:cursor-not-allowed text-[#2b2f36]"
            type="button"
            disabled
          >
            发放（+）
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9e6f5] bg-[rgba(255,255,255,0.85)] px-3 py-[10px] transition-[160ms] ease disabled:opacity-[0.55] disabled:cursor-not-allowed text-[#2b2f36]"
            type="button"
            disabled
          >
            设置为该值
          </button>
        </div>

        <div className="inline-flex items-center gap-2 px-[10px] py-2 rounded-full text-[12px] border border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.9)] text-[#6b7480]">
          <span>提示</span>&nbsp;<strong className="text-[#2b2f36]">发放</strong>&nbsp;
          <span>更像"给零花钱"</span>
        </div>
      </div>
    </section>
  );
}
