"use client";
export default function ContentError({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>内容暂时不可用</h1>
      <p>请稍后重试。</p>
      <button onClick={reset}>重新加载</button>
    </main>
  );
}
