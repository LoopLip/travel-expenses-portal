import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Alert, Box, Button, Collapse, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { RECEIPT_TYPES, receiptApi, receiptFileError } from '@/entities/expense'
import type { ReceiptRecognition } from '@/entities/expense'
import { errorMessage } from '@/shared/api'
import { useQuery } from '@/shared/lib'

interface Props {
  /** Уже приложенный к расходу чек (при изменении расхода). */
  attached: boolean
  onBusyChange: (busy: boolean) => void
  onRecognized: (result: ReceiptRecognition) => void
  onRemove: () => void
}

type Outcome = { severity: 'success' | 'info' | 'warning' | 'error'; text: string }

/**
 * Загрузка фото чека: проверка типа и размера, миниатюра, отправка на распознавание, понятные сообщения.
 * Если на сервере нет Tesseract, кнопка отключена, а форму можно заполнить вручную.
 */
export default function ReceiptUpload({ attached, onBusyChange, onRecognized, onRemove }: Props) {
  const status = useQuery((signal) => receiptApi.status(signal))
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const available = status.data?.available === true

  // Освобождаем память, занятую миниатюрой, при замене файла и при закрытии формы
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // чтобы тот же файл можно было выбрать повторно
    if (!file) return
    const problem = receiptFileError(file)
    if (problem) {
      setOutcome({ severity: 'error', text: problem })
      return
    }
    setPreview(URL.createObjectURL(file))
    setOutcome(null)
    setBusy(true)
    onBusyChange(true)
    try {
      const result = await receiptApi.recognize(file)
      onRecognized(result)
      setOutcome(result.recognized ? { severity: result.amount && result.expense_date ? 'success' : 'info', text: result.message } : { severity: 'warning', text: 'Не удалось распознать сумму и дату, введите вручную' })
    } catch (err) {
      setPreview(null)
      setOutcome({ severity: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  const remove = () => {
    setPreview(null)
    setOutcome(null)
    onRemove()
  }

  const unavailableHint = 'Распознавание недоступно на сервере, введите данные вручную'
  const button = (
    <span>
      <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={!available || busy}>
        Загрузить фото чека
        <input hidden type="file" accept={RECEIPT_TYPES.join(',')} onChange={choose} data-testid="receipt-input" />
      </Button>
    </span>
  )

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }} data-testid="receipt-upload">
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        {available ? button : <Tooltip title={status.loading ? 'Проверяем, доступно ли распознавание…' : unavailableHint}>{button}</Tooltip>}
        {(preview || attached) && !busy && <Button color="inherit" onClick={remove}>Убрать чек</Button>}
      </Stack>
      {!status.loading && !available && <Typography variant="body2" color="text.secondary" data-testid="receipt-unavailable">{unavailableHint}</Typography>}
      {preview && (
        <Box component="img" src={preview} alt="Выбранный чек" sx={{ maxWidth: 160, maxHeight: 200, objectFit: 'contain', border: 1, borderColor: 'divider', borderRadius: 1 }} />
      )}
      {!preview && attached && <Typography variant="body2" color="text.secondary">К расходу приложен чек</Typography>}
      {busy && (
        <Box role="status" aria-live="polite">
          <Typography variant="body2" sx={{ mb: 0.5 }}>Распознаём чек…</Typography>
          <LinearProgress />
        </Box>
      )}
      <Collapse in={Boolean(outcome)}>
        {outcome && <Alert severity={outcome.severity} data-testid="receipt-outcome">{outcome.text}</Alert>}
      </Collapse>
    </Stack>
  )
}
