import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()

  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user') || 'all'
  const status = searchParams.get('status') || 'all'
  const period = searchParams.get('period') || 'all'

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

    let startDate: string | null = null

    if (period === 'today') {
      startDate = getDateDaysAgo(0)
    } else if (period === '7d') {
      startDate = getDateDaysAgo(7)
    } else if (period === '30d') {
      startDate = getDateDaysAgo(30)
    }

  if (userId !== 'all') {
    query = query.eq('user_id', userId)
  }

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
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