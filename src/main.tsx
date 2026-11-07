import ReactDOM from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import { EXTRA_CSS } from './core/extraCss'
import App from './App'

// 论文版面样式（页眉页脚、目录、脚注、图表题注……）与应用主样式分开维护，
// 导出 HTML 时用的是同一份字符串，避免「屏幕上好好的，导出来变样」。
const extra = document.createElement('style')
extra.id = 'mf-extra-css'
extra.textContent = EXTRA_CSS
document.head.appendChild(extra)

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
