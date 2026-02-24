// CreateNodeDialog — 创建新节点弹窗

import { useState, useCallback, useEffect, useRef } from 'react';

export interface CreateNodeDialogProps {
  /** Existing node key list (for conflict detection) */
  existingKeys: string[];
  /** Confirm callback */
  onConfirm: (key: string, label: string) => void;
  /** Cancel callback */
  onCancel: () => void;
}

export function CreateNodeDialog({
  existingKeys,
  onConfirm,
  onCancel,
}: CreateNodeDialogProps) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const keyInputRef = useRef<HTMLInputElement>(null);

  const isDuplicate = existingKeys.includes(key);
  const isValid = key.trim() !== '' && label.trim() !== '' && !isDuplicate;

  // 自动聚焦
  useEffect(() => {
    keyInputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid) {
        onConfirm(key.trim(), label.trim());
      }
    },
    [isValid, key, label, onConfirm],
  );

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="w-[340px] rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
      >
        <h3 className="mb-4 text-[15px] font-semibold text-gray-800">
          添加节点
        </h3>

        {/* Key 输入 */}
        <div className="mb-3">
          <label className="mb-1 block text-[12px] font-medium text-gray-600">
            节点 Key
          </label>
          <input
            ref={keyInputRef}
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="例如：myNode"
            className={`w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-colors ${
              isDuplicate ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            style={{ '--tw-ring-color': '#99f6e4' } as React.CSSProperties}
          />
          {isDuplicate && (
            <p className="mt-1 text-[11px] text-red-500">
              Key &quot;{key}&quot; 已存在
            </p>
          )}
        </div>

        {/* Label 输入 */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] font-medium text-gray-600">
            节点标签
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：数据处理"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:shadow-none"
            style={{
              background: isValid
                ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
                : '#9ca3af',
            }}
          >
            确认
          </button>
        </div>
      </form>
    </div>
  );
}
