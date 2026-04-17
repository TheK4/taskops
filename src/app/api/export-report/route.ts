import { NextRequest, NextResponse } from 'next/server'
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
    const PDFDocumentModule = await import('pdfkit')
    const PDFDocument = PDFDocumentModule.default

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

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
    })

    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pdfReady = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    doc.fontSize(22).text('TaskOps - Relatório Operacional', { align: 'left' })
    doc.moveDown(0.5)

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Período: ${formatPeriodLabel(period)}`)
    doc.text(`Status filtrado: ${status === 'all' ? 'Todos' : status}`)
    doc.text(`Usuário filtrado: ${userId === 'all' ? 'Todos' : getUserLabel(userId)}`)
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`)

    doc.moveDown(1)
    doc.fillColor('#000000')
    doc.fontSize(16).text('Resumo')
    doc.moveDown(0.5)

    doc.fontSize(11).text(`Total de tarefas: ${totalTasks}`)
    doc.text(`Pendentes: ${pendingTasks}`)
    doc.text(`Atrasadas: ${overdueTasks}`)
    doc.text(`Concluídas: ${doneTasks}`)

    doc.moveDown(1)
    doc.fontSize(16).text('Tarefas')
    doc.moveDown(0.5)

    if (!tasks || tasks.length === 0) {
      doc.fontSize(11).text('Nenhuma tarefa encontrada para os filtros selecionados.')
    } else {
      tasks.slice(0, 40).forEach((task, index) => {
        if (doc.y > 720) {
          doc.addPage()
        }

        doc
          .fontSize(12)
          .fillColor('#000000')
          .text(`${index + 1}. ${task.title}`)

        doc
          .fontSize(10)
          .fillColor('#555555')
          .text(`Responsável: ${getUserLabel(task.user_id)}`)
        doc.text(`Status: ${task.status}`)
        doc.text(`Data: ${task.start_date}`)
        doc.text(`Recorrência: ${task.recurrence_type}`)
        doc.text(`Descrição: ${task.description || '-'}`)

        doc.moveDown(0.8)
      })
    }

    doc.end()

    const pdfBuffer = await pdfReady
    const pdfBytes = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfBytes, {
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