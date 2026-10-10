// 浏览器推送通知：在页面不可见时通知关键事件
// 用户可见时靠 Toast，不可见时靠系统通知

let permissionRequested = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  if (!permissionRequested) {
    permissionRequested = true;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

let lastNotifyAt = 0;
const MIN_INTERVAL_MS = 3000; // 最小 3 秒间隔，避免轰炸

export function pushNotification(title: string, body: string, icon?: string) {
  if (typeof document !== 'undefined' && !document.hidden) return; // 页面可见时不弹通知
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const now = Date.now();
  if (now - lastNotifyAt < MIN_INTERVAL_MS) return;
  lastNotifyAt = now;

  try {
    const n = new Notification(title, {
      body,
      icon: icon || 'https://o1942.github.io/3God/favicon.ico',
      tag: 'game-event',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 10000);
  } catch {
    /* ignore */
  }
}
