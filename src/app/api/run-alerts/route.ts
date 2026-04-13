import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const TZ = 'America/Sao_Paulo'

function getTodayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function parseYMDToLocalDate(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateToYMD(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToYMD(ymd: string, days: number) {
  const date = parseYMDToLocalDate(ymd)
  date.setDate(date.getDate() + days)
  return formatDateToYMD(date)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const today = getTodayInSaoPaulo()

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'done')

  if (tasksError) {
    return NextResponse.json(
      { error: tasksError.message },
      { status: 500 }
    )
  }

  let createdLogs = 0
  let sentEmails = 0
  const errors: string[] = []

  for (const task of tasks || []) {
    const dueToday = task.start_date === today

    let alertToday = false

    if (task.remind_offset_minutes && task.remind_offset_minutes > 0) {
      const remindDays = Math.floor(task.remind_offset_minutes / 1440)
      const alertDate = addDaysToYMD(task.start_date, -remindDays)
      alertToday = alertDate === today
    }

    if (!dueToday && !alertToday) {
      continue
    }

    const scheduledFor = `${today}T00:00:00`

    const inAppMessage = dueToday
      ? `A tarefa "${task.title}" vence hoje.`
      : `Lembrete: a tarefa "${task.title}" está próxima do vencimento.`

    const { data: existingInAppLog } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('task_id', task.id)
      .eq('user_id', task.user_id)
      .eq('channel', 'in_app')
      .eq('scheduled_for', scheduledFor)
      .maybeSingle()

    if (!existingInAppLog) {
      const { error: inAppInsertError } = await supabase
        .from('notification_logs')
        .insert({
          task_id: task.id,
          user_id: task.user_id,
          channel: 'in_app',
          status: 'sent',
          message: inAppMessage,
          scheduled_for: scheduledFor,
          sent_at: new Date().toISOString(),
        })

      if (inAppInsertError) {
        errors.push(`Erro log in_app ${task.title}: ${inAppInsertError.message}`)
      } else {
        createdLogs += 1
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', task.user_id)
      .maybeSingle()

    if (profileError) {
      errors.push(`Erro ao buscar profile ${task.user_id}: ${profileError.message}`)
      continue
    }

    if (!profile?.email) {
      errors.push(`Usuário ${task.user_id} sem email no profile.`)
      continue
    }

    const { data: existingEmailLog } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('task_id', task.id)
      .eq('user_id', task.user_id)
      .eq('channel', 'email')
      .eq('scheduled_for', scheduledFor)
      .maybeSingle()

    if (existingEmailLog) {
      continue
    }

    const emailMessage = dueToday
      ? `A tarefa "${task.title}" vence hoje.`
      : `Lembrete: a tarefa "${task.title}" está próxima do vencimento.`

    const subject = dueToday
      ? `TaskOps: "${task.title}" vence hoje`
      : `TaskOps: lembrete da tarefa "${task.title}"`

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Olá${profile.full_name ? `, ${profile.full_name}` : ''}</h2>
        <p>${emailMessage}</p>
        <p><strong>Tarefa:</strong> ${task.title}</p>
        <p><strong>Data:</strong> ${task.start_date}</p>
        <p><strong>Status:</strong> ${task.status}</p>
        <hr />
        <p>Este email foi enviado automaticamente pelo TaskOps.</p>
      </div>
    `

    const { error: emailError } = await resend.emails.send({
      from: 'TaskOps <onboarding@resend.dev>',
      to: profile.email,
      subject,
      html,
    })

    if (emailError) {
      errors.push(`Erro ao enviar email para ${profile.email}: ${emailError.message}`)

      await supabase.from('notification_logs').insert({
        task_id: task.id,
        user_id: task.user_id,
        channel: 'email',
        status: 'failed',
        message: `Falha ao enviar email: ${emailMessage}`,
        scheduled_for: scheduledFor,
        error_message: emailError.message,
      })

      continue
    }

    await supabase.from('notification_logs').insert({
      task_id: task.id,
      user_id: task.user_id,
      channel: 'email',
      status: 'sent',
      message: `Email enviado: ${emailMessage}`,
      scheduled_for: scheduledFor,
      sent_at: new Date().toISOString(),
    })

    sentEmails += 1
  }

  return NextResponse.json({
    success: true,
    today,
    tasksFound: tasks?.length || 0,
    createdLogs,
    sentEmails,
    errors,
  })
}