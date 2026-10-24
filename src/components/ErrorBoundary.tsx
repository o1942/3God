import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null; info: string };

// 全局错误边界：任何渲染期异常都不再是"白屏"，
// 而是显示错误详情 + 一键恢复（清本地缓存，重新从云端拉存档）
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack || '' });
    console.error('[ErrorBoundary]', error, info);
  }

  // 只清存档类数据，保留账号会话
  private clearSaves = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('travian-mvp') || k.startsWith('zhuolu-'))) {
          if (k === 'zhuolu-session-token') continue;
          keys.push(k);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a1612', color: '#e8ddd0', fontFamily: 'system-ui, sans-serif', padding: 24,
      }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>游戏加载出错了</h1>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16, lineHeight: 1.6 }}>
            渲染过程中发生异常，页面被保护性中断（不再白屏）。
            通常由本地旧存档与新版本不兼容导致。点击下方按钮清掉本地缓存，会重新从云端拉取你的存档。
          </p>
          <pre style={{
            background: '#0f0d0b', border: '1px solid #3a322a', borderRadius: 8, padding: 12,
            fontSize: 11, lineHeight: 1.5, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap',
            marginBottom: 16,
          }}>
            {this.state.error.message}
            {this.state.info ? `\n${this.state.info.slice(0, 800)}` : ''}
          </pre>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px', borderRadius: 8, border: '1px solid #3a322a',
                background: '#241d17', color: '#e8ddd0', fontSize: 14, cursor: 'pointer',
              }}
            >
              重新加载
            </button>
            <button
              onClick={this.clearSaves}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: '#c8a24a', color: '#1a1612', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              清除本地存档并从云端恢复
            </button>
          </div>
        </div>
      </div>
    );
  }
}
