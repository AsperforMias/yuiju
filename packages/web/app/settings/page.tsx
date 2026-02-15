import { XXXCard } from './xxx-card';

export default function SettingsPage() {
  return (
    <div>
      <div>
        <h1>Settings</h1>
        <p>只展示 UI，不写入浏览器存储</p>
      </div>
      <XXXCard />
      {/* <AboutCard /> */}
    </div>
  );
}

// jsx: React fiber 链
// jsx，虚拟DOM
const jsx = SettingsPage();

// nextjs 的 NodeJS 环境下的 React 会将 jsx 转换成字符串
// const htmlStr = jsxTransform(jsx);
