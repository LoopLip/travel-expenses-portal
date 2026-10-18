import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PageHeader from '../shared/ui/PageHeader'
import { trips } from '../entities/trip'
import { categoryLabel } from '../entities/expense'
import type { ExpenseCategory } from '../entities/expense'
// Р”РµРјРѕРЅСЃС‚СЂР°С†РёСЏ СЃС†РµРЅР°СЂРёСЏ В«С„РѕС‚Рѕ С‡РµРєР° в†’ РїСЂРµРґР·Р°РїРѕР»РЅРµРЅРёРµ С„РѕСЂРјС‹В».
// Р Р°СЃРїРѕР·РЅР°РІР°РЅРёРµ Р·РґРµСЃСЊ РёРјРёС‚РёСЂСѓРµС‚СЃСЏ С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё; СЂРµР°Р»СЊРЅС‹Р№ OCR РЅРµ РїРѕРґРєР»СЋС‡С‘РЅ.
const DEMO_RECOGNIZED = { amount: '3450', date: '2026-10-12' }

export default function ExpenseFormPage() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setAmount(DEMO_RECOGNIZED.amount)
    setDate(DEMO_RECOGNIZED.date)
  }

  return (
    <>
      <PageHeader title="РќРѕРІС‹Р№ СЂР°СЃС…РѕРґ" subtitle="Р—Р°РіСЂСѓР·РёС‚Рµ С„РѕС‚Рѕ С‡РµРєР° вЂ” СЃСѓРјРјР° Рё РґР°С‚Р° РїРѕРґСЃС‚Р°РІСЏС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё" />
      <Card>
        <CardContent>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ alignSelf: 'flex-start' }}>
              Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ С‡РµРєР°
              <input hidden type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
            </Button>
            {fileName && (
              <Alert severity="info">
                Р¤Р°Р№Р» В«{fileName}В» РѕР±СЂР°Р±РѕС‚Р°РЅ (РґРµРјРѕ-СЂРµР¶РёРј). РџСЂРѕРІРµСЂСЊС‚Рµ СЂР°СЃРїРѕР·РЅР°РЅРЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РїРµСЂРµРґ СЃРѕС…СЂР°РЅРµРЅРёРµРј.
              </Alert>
            )}
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="РљРѕРјР°РЅРґРёСЂРѕРІРєР°" select fullWidth defaultValue={trips[0].id}>
                {trips.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.destination}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="РљР°С‚РµРіРѕСЂРёСЏ" select fullWidth defaultValue="transport">
                {(Object.keys(categoryLabel) as ExpenseCategory[]).map((c) => (
                  <MenuItem key={c} value={c}>{categoryLabel[c]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="РћРїРёСЃР°РЅРёРµ" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="РЎСѓРјРјР°, в‚Ѕ" type="number" fullWidth value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Р”Р°С‚Р°"
                type="date"
                fullWidth
                value={date}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          </Grid>

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            РЎРѕС…СЂР°РЅРµРЅРёРµ Р±СѓРґРµС‚ РїРѕРґРєР»СЋС‡РµРЅРѕ РїРѕСЃР»Рµ СЂРµР°Р»РёР·Р°С†РёРё backend.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Button variant="contained">РЎРѕС…СЂР°РЅРёС‚СЊ</Button>
            <Button component={RouterLink} to="/expenses">РћС‚РјРµРЅР°</Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  )
}
