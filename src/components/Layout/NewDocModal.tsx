import { useEffect, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { Button, Modal, TextInput } from '../ui'
import { useEditorStore } from '../../store/useEditorStore'

/**
 * 新建文档时先问名字。
 *
 * 以前是「先建一篇未命名文档，再双击重命名」——名字没想好就多一步、
 * 想好了还得回列表里找。这里直接输入文件名，回车即建；目录跟着侧栏
 * 当前选中的位置走，不用再挑。
 */
export default function NewDocModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dir = useEditorStore((s) => s.newDocDir)
  const mode = useEditorStore((s) => s.mode)
  const createLocalDoc = useEditorStore((s) => s.createLocalDoc)
  const createDoc = useEditorStore((s) => s.createDoc)

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setError('')
    setBusy(false)
  }, [open])

  const submit = async () => {
    if (busy) return
    const raw = name.trim()
    if (!raw) {
      setError('先给文档起个名字')
      return
    }
    if (/[\\/:*?"<>|]/.test(raw)) {
      setError('文件名里不能出现 \\ / : * ? " < > |')
      return
    }
    setBusy(true)
    try {
      if (mode === 'local') {
        const created = await createLocalDoc(dir, raw)
        if (!created) {
          setError('创建失败：同名文件可能已存在，换个名字试试')
          return
        }
      } else {
        createDoc(raw.replace(/\.(md|markdown|mdx)$/i, ''))
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="新建文档"
      subtitle={mode === 'local' ? `建在 ${dir ? `${dir}/` : '工作区根目录'}` : '会作为一篇新文档加入列表'}
      icon={<FilePlus2 size={18} />}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? '创建中…' : '创建'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <TextInput
          value={name}
          onChange={(v) => {
            setName(v)
            if (error) setError('')
          }}
          placeholder="例如：第三章-特征值"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
        />
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          {mode === 'local' ? '不用写 .md，会自动补上。回车直接创建。' : '回车直接创建。'}
        </p>
        {error && <p className="text-[11.5px] text-amber-600">{error}</p>}
      </div>
    </Modal>
  )
}
