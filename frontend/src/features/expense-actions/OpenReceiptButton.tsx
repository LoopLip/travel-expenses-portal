import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import ReceiptIcon from '@mui/icons-material/ReceiptOutlined'
import { hasStoredReceipt, receiptApi } from '@/entities/expense'
import type { Expense } from '@/entities/expense'
import { ApiError, errorMessage } from '@/shared/api'
import { useNotify } from '@/shared/ui'

const BLOB_LIFETIME_MS = 60_000 // ссылку на файл в памяти освобождаем через минуту: вкладка уже успеет его показать

/**
 * «Открыть чек»: файл запрашивается с токеном (обычная ссылка без Authorization не пройдёт), превращается в blob
 * и открывается в новой вкладке. Кнопка видна, только если у расхода есть настоящий загруженный файл.
 */
export default function OpenReceiptButton({ expense }: { expense: Expense }) {
  const notify = useNotify()
  const [busy, setBusy] = useState(false)
  if (!hasStoredReceipt(expense.receipt_url)) return null

  const open = async () => {
    // Вкладку открываем сразу по клику: открытие после ожидания запроса браузер может заблокировать как всплывающее окно
    const tab = window.open('', '_blank')
    setBusy(true)
    try {
      const url = URL.createObjectURL(await receiptApi.download(expense.id))
      if (tab) tab.location.href = url
      else window.location.assign(url)
      setTimeout(() => URL.revokeObjectURL(url), BLOB_LIFETIME_MS)
    } catch (e) {
      tab?.close()
      notify(e instanceof ApiError && e.status === 404 ? 'Файл чека недоступен' : errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tooltip title="Открыть чек">
      <span>
        <IconButton size="small" aria-label="Открыть чек" onClick={open} disabled={busy}>
          <ReceiptIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}
