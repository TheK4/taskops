import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

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

function getCurrentTimeInSaoPauloHHMM() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const hour = parts.find((p) => p.type === 'hour')?.value || '00'
  const minute = parts.find((p) => p.type === 'minute')?.value || '00'

  return `${hour}:${minute}`
}

function hhmmToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function isWithinSummaryWindow(summaryTime: string, nowHHMM: string, windowMinutes = 5) {
  const summaryMinutes = hhmmToMinutes(summaryTime)
  const nowMinutes = hhmmToMinutes(nowHHMM)

  return nowMinutes >= summaryMinutes && nowMinutes <= summaryMinutes + windowMinutes
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    const today = getTodayInSaoPaulo()
    const nowHHMM = getCurrentTimeInSaoPauloHHMM()

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, daily_summary_enabled, daily_summary_time')
      .eq('daily_summary_enabled', true)

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    let sent = 0
    const errors: string[] = []

    for (const profile of profiles || []) {
      const scheduledFor = `${today}T00:00:00`
      if (!profile.email) continue

const summaryTime = profile.daily_summary_time?.slice(0, 5)

if (!summaryTime || !isWithinSummaryWindow(summaryTime, nowHHMM, 5)) {
  continue
}

const { data: existingSummaryLog } = await supabase
  .from('notification_logs')
  .select('id')
  .eq('user_id', profile.id)
  .eq('channel', 'email')
  .eq('scheduled_for', scheduledFor)
  .eq('message', 'Resumo diário enviado')
  .maybeSingle()

if (existingSummaryLog) {
  continue
}

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue'])
        .eq('start_date', today)
        .order('due_time', { ascending: true })

      const lines =
        tasks && tasks.length > 0
          ? tasks
              .map(
                (task) =>
                  `<li><strong>${task.title}</strong> — ${task.start_date}${
                    task.due_time ? ` às ${task.due_time}` : ''
                  } (${task.status})</li>`
              )
              .join('')
          : '<li>Nenhuma tarefa pendente para hoje.</li>'

      const { error: emailError } = await resend.emails.send({
        from: 'TaskOps <onboarding@resend.dev>',
        to: 'talesaknauer@gmail.com',
        subject: 'TaskOps: resumo diário das tarefas',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Bom dia${profile.full_name ? `, ${profile.full_name}` : ''}</h2>
            <p>Segue o resumo das suas tarefas para hoje (${today}).</p>
            <ul>${lines}</ul>
            <hr />
            <p>Enviado automaticamente pelo TaskOps.</p>
          </div>
        `,
      })

if (emailError) {
  errors.push(`${profile.email}: ${emailError.message}`)
  continue
}

await supabase.from('notification_logs').insert({
  user_id: profile.id,
  task_id: null,
  channel: 'email',
  status: 'sent',
  message: 'Resumo diário enviado',
  scheduled_for: scheduledFor,
  sent_at: new Date().toISOString(),
})

sent += 1
    }

    return NextResponse.json({
      success: true,
      today,
      nowHHMM,
      sent,
      errors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao enviar resumo diário',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}