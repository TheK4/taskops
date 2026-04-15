'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (currentProfile?.role !== 'admin') {
    throw new Error('Apenas admin pode alterar papéis.')
  }

  if (!['member', 'manager', 'admin'].includes(role)) {
    throw new Error('Papel inválido.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/team')
}