import styles from "../home.module.css";

type HomeWorldCardProps = {
  time?: string;
};

export function HomeWorldCard({ time }: HomeWorldCardProps) {
  const displayTime = time ?? "2026-02-07 19:32";
  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-white/90 shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h3 className="m-0 text-[14px] font-black tracking-[0.2px]">世界状态</h3>
          <span className="inline-flex items-center gap-2 px-[10px] py-2 border border-[rgba(217,230,245,0.9)] rounded-full bg-[rgba(247,251,255,0.9)] text-[#6b7480] text-[12px] whitespace-nowrap">
            <span className="text-[#6b7480]">世界时间</span>&nbsp;
            <strong className="text-[#2b2f36]">{displayTime}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
