import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()

  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user') || 'all'
  const status = searchParams.get('status') || 'all'

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (userId !== 'all') {
    query = query.eq('user_id', userId)
  }

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: tasks, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = [...new Set((tasks || []).map((task) => task.user_id))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  function getUserLabel(userId: string) {
    const found = (profiles || []).find((p) => p.id === userId)
    return found?.full_name || found?.email || 'Usuário'
  }

  const headers = [
    'Responsável',
    'Título',
    'Descrição',
    'Status',
    'Data',
    'Recorrência',
    'Dia fixo',
    'Aviso (minutos)',
    'Criado em',
  ]

  const rows = (tasks || []).map((task) => [
    getUserLabel(task.user_id),
    task.title ?? '',
    task.description ?? '',
    task.status ?? '',
    task.start_date ?? '',
    task.recurrence_type ?? '',
    task.recurrence_day_of_month ?? '',
    task.remind_offset_minutes ?? '',
    task.created_at ?? '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n')

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="taskops-relatorio.csv"',
    },
  })
}