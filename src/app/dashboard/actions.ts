'use server'

import { revalidatePath } from 'next/cache'

export async function runAlertsManually() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  if (!baseUrl) {
    throw new Error('URL base do projeto não encontrada.')
  }

  const normalizedBaseUrl = baseUrl.startsWith('http')
    ? baseUrl
    : `https://${baseUrl}`

  const response = await fetch(`${normalizedBaseUrl}/api/run-alerts`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || 'Erro ao executar varredura de alertas.')
  }

  revalidatePath('/dashboard')
  revalidatePath('/tasks')

  return data
}