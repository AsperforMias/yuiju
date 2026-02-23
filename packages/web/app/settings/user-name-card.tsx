import styles from "./settings.module.css";

type UserNameCardProps = {
  userName?: string;
};

export function UserNameCard({ userName }: UserNameCardProps) {
  const displayUserName = userName ?? "yixiaojiu";
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
          user_name 将用于对话时的用户标识。此处仅为 UI 稿，不保存到 localStorage。
        </p>

        <div className="grid gap-[6px]">
          <label className="text-[12px] text-[#6b7480]" htmlFor="userNameInput">
            user_name
          </label>
          <input
            id="userNameInput"
            className="w-full rounded-xl border border-[#d9e6f5] bg-[rgba(255,255,255,0.9)] px-3 py-[10px] text-[#2b2f36] outline-none transition-[border-color,box-shadow] duration-[0.16s] ease focus:border-[rgba(145,196,238,0.8)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.2)]"
            defaultValue={displayUserName}
          />
        </div>

        <div className="flex items-center gap-[10px]">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-[rgba(145,196,238,0.55)] bg-[rgba(145,196,238,0.62)] px-3 py-[10px] text-[#2b2f36] disabled:opacity-[0.55] disabled:cursor-not-allowed"
            type="button"
            disabled
          >
            保存
          </button>
          <span className="text-[12px] text-[#6b7480]">（仅展示按钮状态）</span>
        </div>
      </div>
    </section>
  );
}
