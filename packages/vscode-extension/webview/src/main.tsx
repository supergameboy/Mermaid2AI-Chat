/**
 * Mermaid2AIChat — VSCode Webview 入口
 */
import { createRoot } from 'react-dom/client';
import App from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('找不到 #root 挂载节点');
}

// 不使用 StrictMode：webview 是生产环境，StrictMode 双执行会导致 useEffect 间隙的消息丢失
createRoot(rootElement).render(<App />);
