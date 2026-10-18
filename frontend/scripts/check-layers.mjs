// Проверка правила слоёв (упрощённый FSD): app → pages → features → entities → shared.
// Слой может импортировать только нижележащие слои; features/entities не импортируют соседей своего слоя.
// Запуск: npm run lint:layers
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const order = ['app', 'pages', 'features', 'entities', 'shared']
const sameLayerForbidden = new Set(['features', 'entities'])
const errors = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(name)) check(full)
  }
}

function layerOf(file) {
  const rel = path.relative(src, file).split(path.sep)
  return order.includes(rel[0]) ? { layer: rel[0], slice: rel[1] } : null
}

function check(file) {
  const from = layerOf(file)
  if (!from) return
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
    const spec = m[1]
    let target = null
    if (spec.startsWith('@/')) target = path.join(src, spec.slice(2))
    else if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec)
    if (!target) continue
    const to = layerOf(target)
    if (!to) continue
    const fi = order.indexOf(from.layer)
    const ti = order.indexOf(to.layer)
    const rel = path.relative(src, file)
    if (ti < fi) errors.push(`${rel}: слой «${from.layer}» импортирует вышележащий «${to.layer}» (${spec})`)
    else if (ti === fi && sameLayerForbidden.has(from.layer) && to.slice !== from.slice)
      errors.push(`${rel}: срез «${from.layer}/${from.slice}» импортирует соседний срез «${to.slice}» (${spec})`)
  }
}

walk(src)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('Слои соблюдены: ошибок импорта нет.')
