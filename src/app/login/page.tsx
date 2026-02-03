export default function LoginPage() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-100">登录</h1>
        <p className="mt-2 text-sm text-neutral-300">
          登录后可用于云端存档与跨设备记录同步。
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-400"
          disabled
        >
          暂未接入
        </button>
      </div>
    </div>
  );
}
