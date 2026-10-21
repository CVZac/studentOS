import { useCallback, useEffect, useState } from 'react';

interface DownloadsNamespace {
  save(request: { filename: string; data: string }): Promise<{ status: 'saved' | 'delivered' }>;
}

declare global {
  interface Window {
    /** claude.ai Artifact 查看器注入的运行时；普通网页中不存在 */
    claude?: { use(name: string): Promise<unknown> };
  }
}

export type SaveOutcome = 'saved' | 'declined' | 'failed';

function blobDownload(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 保存文件：在 Artifact 查看器中通过 downloads 能力（需查看者确认），
 * 其他环境直接触发浏览器下载。available 为 false 时应隐藏导出入口。
 */
export function useFileSaver() {
  const hosted = typeof window.claude?.use === 'function';
  const [downloads, setDownloads] = useState<DownloadsNamespace | null>(null);
  const [resolved, setResolved] = useState(!hosted);

  useEffect(() => {
    if (!hosted) return;
    let alive = true;
    window
      .claude!.use('downloads')
      .then((ns) => {
        if (!alive) return;
        setDownloads((ns as DownloadsNamespace | null) ?? null);
        setResolved(true);
      })
      .catch(() => alive && setResolved(true));
    return () => {
      alive = false;
    };
  }, [hosted]);

  const save = useCallback(
    async (filename: string, text: string): Promise<SaveOutcome> => {
      if (!hosted) {
        blobDownload(filename, text);
        return 'saved';
      }
      if (!downloads) return 'failed';
      try {
        await downloads.save({ filename, data: text });
        return 'saved';
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === 'declined') return 'declined';
        if (code !== 'rate_limited') setDownloads(null);
        return 'failed';
      }
    },
    [hosted, downloads],
  );

  return { available: !hosted || downloads !== null, resolved, save };
}
