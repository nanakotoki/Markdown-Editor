import { searchFormulas } from './formulaLibrary'
import type { AIConfig } from '../store/useEditorStore'

/**
 * ============================================================================
 *  aiService.ts —— 大模型接口封装（OpenAI 兼容 / DeepSeek / Gemini）
 * ----------------------------------------------------------------------------
 *  · 自然语言 -> LaTeX（流式）
 *  · 公式重构 / 解释
 *  · 手写板 & 截图 OCR（多模态 Vision）
 *  · 未配置 Key 时：本地公式库语义检索兜底
 * ============================================================================
 */

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

export function isAIConfigured(cfg: AIConfig): boolean {
  return Boolean(cfg.apiKey && cfg.baseUrl && cfg.model)
}

const SYSTEM_PROMPT = `你是 MathFlow 编辑器的公式助手，服务于中国理工科学生与研究者。
规则：
1. 只输出 LaTeX 数学源码，不要输出任何解释、不要用 \`\`\` 包裹、不要加 $ 或 $$ 定界符。
2. 使用 KaTeX 支持的语法（支持 \\ce{} 化学式、\\begin{pmatrix} 等环境）。
3. 若用户描述含糊，选择最常见、最标准的写法。
4. 多行公式使用 \\begin{aligned} ... \\end{aligned} 或 \\begin{cases} ... \\end{cases}。`

function stripFences(s: string): string {
  let out = s.trim()
  out = out.replace(/^```(?:latex|tex|math)?\s*/i, '').replace(/```\s*$/i, '')
  out = out.replace(/^\$\$?/, '').replace(/\$\$?$/, '')
  return out.trim()
}

async function readStream(res: Response, onDelta?: (t: string) => void): Promise<string> {
  if (!res.body) throw new Error('接口未返回数据流')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta =
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          json?.candidates?.[0]?.content?.parts?.[0]?.text ??
          ''
        if (typeof delta === 'string' && delta) {
          full += delta
          onDelta?.(delta)
        }
      } catch {
        /* 忽略半包 */
      }
    }
  }
  return full
}

/** 通用对话调用（DeepSeek 等 OpenAI 兼容接口流式；Gemini 走非流式） */
export async function chat(cfg: AIConfig, turns: ChatTurn[], onDelta?: (t: string) => void): Promise<string> {
  if (!isAIConfigured(cfg)) throw new Error('尚未配置 API Key')
  const gemini = cfg.provider === 'gemini'
  const url = gemini
    ? `${cfg.baseUrl.replace(/\/$/, '')}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`
    : `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`

  const body = gemini
    ? {
        contents: turns
          .filter((t) => t.role !== 'system')
          .map((t) => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: Array.isArray(t.content)
              ? t.content.map((p) =>
                  p.type === 'image_url'
                    ? { inline_data: { mime_type: 'image/png', data: (p.image_url?.url ?? '').split(',')[1] ?? '' } }
                    : { text: p.text ?? '' }
                )
              : [{ text: t.content }],
          })),
        systemInstruction: { parts: [{ text: String(turns.find((t) => t.role === 'system')?.content ?? '') }] },
      }
    : { model: cfg.model, messages: turns, temperature: 0.2, stream: true }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(gemini ? {} : { Authorization: `Bearer ${cfg.apiKey}` }),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`接口返回 ${res.status}：${text.slice(0, 200) || res.statusText}`)
  }
  if (gemini) {
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''
    onDelta?.(text)
    return text
  }
  return readStream(res, onDelta)
}

/** 自然语言 -> LaTeX */
export async function nlToLatex(
  cfg: AIConfig,
  prompt: string,
  onDelta?: (t: string) => void
): Promise<{ latex: string; source: 'ai' | 'library'; note?: string }> {
  if (!isAIConfigured(cfg)) {
    const best = searchFormulas(prompt, 1)[0]
    if (best) {
      onDelta?.(best.latex)
      return {
        latex: best.latex,
        source: 'library',
        note: `未配置 API Key，已从本地公式库匹配到「${best.name}」`,
      }
    }
    return { latex: '', source: 'library', note: '未配置 API Key，且本地公式库没有匹配结果。请到「AI 设置」中填入接口密钥。' }
  }
  const raw = await chat(
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    onDelta
  )
  return { latex: stripFences(raw), source: 'ai' }
}

/** 公式重构：把已有公式按指令改写 */
export async function refactorFormula(
  cfg: AIConfig,
  latex: string,
  instruction: string,
  onDelta?: (t: string) => void
): Promise<string> {
  if (!isAIConfigured(cfg)) {
    // 离线确定性重构
    if (/aligned|多行/.test(instruction)) {
      return `\\begin{aligned}\n${latex.replace(/\\\\/g, '\\\\')}\n\\end{aligned}`
    }
    if (/dfrac|大分式/.test(instruction)) return latex.replace(/\\frac/g, '\\dfrac')
    if (/矩阵|转置/.test(instruction)) return `${latex}^{\\top}`
    throw new Error('未配置 API Key，只能执行「转为 aligned / 改 \\dfrac / 加转置」等本地重构')
  }
  const raw = await chat(
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请按下列要求改写公式，只输出改写后的 LaTeX 源码。\n要求：${instruction}\n公式：${latex}` },
    ],
    onDelta
  )
  return stripFences(raw)
}

/** 解释公式含义（纯文本输出） */
export async function explainFormula(cfg: AIConfig, latex: string, onDelta?: (t: string) => void): Promise<string> {
  if (!isAIConfigured(cfg)) {
    throw new Error('未配置 API Key，无法生成解释')
  }
  return chat(
    cfg,
    [
      { role: 'system', content: '你是数学与物理教授，用简洁中文解释公式的含义、符号与适用条件。' },
      { role: 'user', content: `解释这个公式：${latex}` },
    ],
    onDelta
  )
}

/** 手写 / 截图 -> LaTeX（多模态） */
export async function recognizeImage(
  cfg: AIConfig,
  dataUrl: string,
  onDelta?: (t: string) => void
): Promise<{ latex: string; source: 'ai' | 'demo'; note?: string }> {
  if (!isAIConfigured(cfg)) {
    const demo = DEMO_HANDWRITING[Math.floor(Math.random() * DEMO_HANDWRITING.length)]
    onDelta?.(demo)
    return {
      latex: demo,
      source: 'demo',
      note: '未配置 API Key：已使用本地笔画特征演示识别。配置多模态接口后可精确识别任意手写/截图公式。',
    }
  }
  const raw = await chat(
    cfg,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '把这张图片里的数学公式转成 LaTeX 源码，只输出源码。' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    onDelta
  )
  return { latex: stripFences(raw), source: 'ai' }
}

const DEMO_HANDWRITING = [
  '\\int_{0}^{\\infty} e^{-x^{2}}\\,\\mathrm{d}x=\\frac{\\sqrt{\\pi}}{2}',
  '\\sum_{n=1}^{\\infty}\\frac{1}{n^{2}}=\\frac{\\pi^{2}}{6}',
  'f(x)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^{2}}{2\\sigma^{2}}}',
  '\\nabla\\cdot\\vec{E}=\\frac{\\rho}{\\varepsilon_{0}}',
]
