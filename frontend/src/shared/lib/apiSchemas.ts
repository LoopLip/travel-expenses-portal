import { z } from 'zod'
import { normalizeMoney } from './money'

/** Общие части Zod-схем ответов backend. Используются мапперами сущностей (entities/x/api/mappers.ts). */

/** id записи: целое положительное число. */
export const apiId = z.number().int().positive()

/** Деньги: backend отдаёт Decimal строкой («5000.50», иногда без копеек), приводим к виду «0.00». */
export const apiMoney = z
  .union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number()])
  .transform((v) => normalizeMoney(v))

/** Календарная дата без часового пояса: «2026-12-01». */
export const apiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Момент времени ISO 8601 с поясом (created_at в UTC: «2026-11-01T11:28:40.616Z»). */
export const apiDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'ожидалась дата и время ISO 8601')
