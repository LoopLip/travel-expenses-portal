// Делает скриншоты всех экранов (desktop и mobile) в docs/screenshots.
// Требуется запущенный frontend (npm run dev) и установленный Chrome/Chromium.
// Переменные: BASE_URL (по умолчанию http://localhost:5173), CHROME_PATH.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:5173'
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots')
mkdirSync(outDir, { recursive: true })

const pages = [
  ['dashboard', '/'],
  ['trips', '/trips'],
  ['trip-details', '/trips/1'],
  ['trip-new', '/trips/new'],
  ['trip-edit', '/trips/1/edit'],
  ['expenses', '/expenses'],
  ['expense-new', '/expenses/new'],
  ['advances', '/advances'],
  ['budgets', '/budgets'],
  ['not-found', '/no-such-page'],
]
const viewports = {
  desktop: { width: 1366, height: 800 },
  mobile: { width: 390, height: 800 },
}

const browser = await chromium.launch({ executablePath: chromePath })
for (const [vpName, viewport] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  for (const [name, route] of pages) {
    await page.goto(base + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900) // демо-API отвечает с задержкой, ждём данные и анимации
    await page.screenshot({ path: path.join(outDir, `${name}-${vpName}.png`), fullPage: true })
  }
  await ctx.close()
}
await browser.close()
console.log('Готово:', outDir)
