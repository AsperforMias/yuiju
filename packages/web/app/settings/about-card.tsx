import styles from "./settings.module.css";

export function AboutCard() {
  return (
    <section className="border border-[#d9e6f5] rounded-2xl bg-[rgba(255,255,255,0.88)] shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden h-full min-h-[520px]">
      <div className="p-[14px] grid gap-[14px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-[24px] font-black tracking-[0.2px]">关于</h3>
          <span className="inline-flex items-center px-[10px] py-2 rounded-full text-[12px] border border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]">
            Info
          </span>
        </div>

        <p className="m-0 text-[15px] text-[#6b7480] leading-[1.55]">
          本页面是 UI 稿（mock），用于快速对齐 PRD 的信息架构、布局与视觉风格。后续可迁移到 Next.js
          页面并替换为真实数据与交互。
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-[10px] py-2 rounded-full text-[12px] border border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]">
            主色 #91c4ee
          </span>
          <span className="inline-flex items-center px-[10px] py-2 rounded-full text-[12px] border border-[rgba(175,122,197,0.25)] bg-[rgba(175,122,197,0.12)] text-[#2b2f36]">
            辅色 #af7ac5
          </span>
          <span className="inline-flex items-center px-[10px] py-2 rounded-full text-[12px] border border-[rgba(250,227,190,0.75)] bg-[rgba(250,227,190,0.55)] text-[#2b2f36]">
            浅杏 #fae3be
          </span>
        </div>

        <ul className="list-none m-0 p-0 grid gap-2">
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>首页</span>
            <span className="text-[#6b7480]">状态 + 地图，聊天抽屉</span>
          </li>
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>动态</span>
            <span className="text-[#6b7480]">时间线 + 轻管理</span>
          </li>
          <li className="flex items-center justify-between gap-[10px] p-[10px] rounded-xl border border-[#d9e6f5] bg-[rgba(247,251,255,0.75)] text-[13px]">
            <span>设置</span>
            <span className="text-[#6b7480]">user_name（UI）</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
