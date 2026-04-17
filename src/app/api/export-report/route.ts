import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatPeriodLabel(period: string) {
  if (period === 'today') return 'Hoje'
  if (period === '7d') return 'Últimos 7 dias'
  if (period === '30d') return 'Últimos 30 dias'
  return 'Todo o período'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user') || 'all'
    const status = searchParams.get('status') || 'all'
    const period = searchParams.get('period') || 'all'

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

    let startDate: string | null = null

    if (period === 'today') {
      startDate = getDateDaysAgo(0)
    } else if (period === '7d') {
      startDate = getDateDaysAgo(7)
    } else if (period === '30d') {
      startDate = getDateDaysAgo(30)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    const { data: tasks, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const userIds = [...new Set((tasks || []).map((task) => task.user_id))]

    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }

    function getUserLabel(userIdValue: string) {
      const found = (profiles || []).find((p) => p.id === userIdValue)
      return found?.full_name || found?.email || 'Usuário'
    }

    const totalTasks = (tasks || []).length
    const pendingTasks = (tasks || []).filter((task) => task.status === 'pending').length
    const overdueTasks = (tasks || []).filter((task) => task.status === 'overdue').length
    const doneTasks = (tasks || []).filter((task) => task.status === 'done').length

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595.28, 841.89]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { width, height } = page.getSize()
    const margin = 50
    let y = height - margin

    function drawText(
      text: string,
      x: number,
      size = 11,
      bold = false,
      color = rgb(0, 0, 0)
    ) {
      const usedFont = bold ? fontBold : font
      page.drawText(text, {
        x,
        y,
        size,
        font: usedFont,
        color,
      })
      y -= size + 6
    }

    function ensureSpace(minSpace = 60) {
      if (y < minSpace) {
        page = pdfDoc.addPage([595.28, 841.89])
        y = height - margin
      }
    }

    drawText('TaskOps - Relatório Operacional', margin, 20, true)
    y -= 6

    drawText(`Período: ${formatPeriodLabel(period)}`, margin, 10, false, rgb(0.4, 0.4, 0.4))
    drawText(`Status filtrado: ${status === 'all' ? 'Todos' : status}`, margin, 10, false, rgb(0.4, 0.4, 0.4))
    drawText(`Usuário filtrado: ${userId === 'all' ? 'Todos' : getUserLabel(userId)}`, margin, 10, false, rgb(0.4, 0.4, 0.4))
    drawText(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, margin, 10, false, rgb(0.4, 0.4, 0.4))

    y -= 10
    drawText('Resumo', margin, 15, true)
    drawText(`Total de tarefas: ${totalTasks}`, margin, 11)
    drawText(`Pendentes: ${pendingTasks}`, margin, 11)
    drawText(`Atrasadas: ${overdueTasks}`, margin, 11)
    drawText(`Concluídas: ${doneTasks}`, margin, 11)

    y -= 10
    drawText('Tarefas', margin, 15, true)

    if (!tasks || tasks.length === 0) {
      drawText('Nenhuma tarefa encontrada para os filtros selecionados.', margin, 11)
    } else {
      for (let i = 0; i < Math.min(tasks.length, 40); i++) {
        const task = tasks[i]
        ensureSpace(120)

        drawText(`${i + 1}. ${task.title}`, margin, 12, true)
        drawText(`Responsável: ${getUserLabel(task.user_id)}`, margin, 10, false, rgb(0.35, 0.35, 0.35))
        drawText(`Status: ${task.status}`, margin, 10, false, rgb(0.35, 0.35, 0.35))
        drawText(`Data: ${task.start_date}`, margin, 10, false, rgb(0.35, 0.35, 0.35))
        drawText(`Recorrência: ${task.recurrence_type}`, margin, 10, false, rgb(0.35, 0.35, 0.35))
        drawText(`Descrição: ${task.description || '-'}`, margin, 10, false, rgb(0.35, 0.35, 0.35))
        y -= 8
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="taskops-relatorio.pdf"',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)

    return NextResponse.json(
      {
        error: 'Erro ao gerar PDF',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}