'use client';
import { useEffect } from 'react';
import useSWRMutation from 'swr/mutation';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function HomePage() {
  // 使用 useSWRMutation 处理 POST 操作
  // trigger: 触发请求的函数
  // isMutating: 请求中时为 true
  // data: 响应数据
  const { data, isMutating, trigger } = useSWRMutation('/api/nodejs/state/xxx', async url => {
    await delay(3000);
    return {
      bar: '11',
    };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    trigger();
  }, []);

  return (
    <div className="px-8">
      <div>home</div>

      <button
        onClick={() => {
          trigger();
          console.log('onClick');
        }}
      >
        Refresh
      </button>

      {isMutating ? <div>loading</div> : <div>{JSON.stringify(data)}</div>}
    </div>
  );
}
