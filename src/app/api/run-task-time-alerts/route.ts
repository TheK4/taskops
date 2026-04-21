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

function isWithinWindow(taskTime: string, nowHHMM: string, windowMinutes = 5) {
  const taskMinutes = hhmmToMinutes(taskTime)
  const nowMinutes = hhmmToMinutes(nowHHMM)

  return nowMinutes >= taskMinutes && nowMinutes <= taskMinutes + windowMinutes
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

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('status', ['pending', 'overdue'])
      .eq('start_date', today)
      .not('due_time', 'is', null)
      .order('due_time', { ascending: true })

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    let sent = 0
    const errors: string[] = []

    for (const task of tasks || []) {
      const taskTime = task.due_time?.slice(0, 5)

      if (!taskTime || !isWithinWindow(taskTime, nowHHMM, 5)) {
        continue
      }

      const scheduledFor = `${today}T${taskTime}:00`

      const { data: existingLog } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('task_id', task.id)
        .eq('user_id', task.user_id)
        .eq('channel', 'email')
        .eq('scheduled_for', scheduledFor)
        .eq('message', 'Alerta por horário da tarefa enviado')
        .maybeSingle()

      if (existingLog) {
        continue
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
        errors.push(`Usuário ${task.user_id} sem email.`)
        continue
      }

      const { error: emailError } = await resend.emails.send({
        from: 'TaskOps <onboarding@resend.dev>',
        to: 'talesaknauer@gmail.com',
        subject: `TaskOps: tarefa "${task.title}" no horário`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <h2>Olá${profile.full_name ? `, ${profile.full_name}` : ''}</h2>
            <p>Este é um lembrete do horário da sua tarefa.</p>

            <div style="margin: 16px 0; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
              <p style="margin: 0 0 8px 0;"><strong>Tarefa:</strong> ${task.title}</p>
              <p style="margin: 0 0 8px 0;"><strong>Data:</strong> ${task.start_date}</p>
              <p style="margin: 0 0 8px 0;"><strong>Horário:</strong> ${taskTime}</p>
              <p style="margin: 0;"><strong>Status:</strong> ${task.status}</p>
            </div>

            <p>Descrição: ${task.description || '-'}</p>

            <hr />
            <p style="font-size: 12px; color: #666;">
              Enviado automaticamente pelo TaskOps.
            </p>
          </div>
        `,
      })

      if (emailError) {
        errors.push(`Erro ao enviar email da task ${task.title}: ${emailError.message}`)

        await supabase.from('notification_logs').insert({
          task_id: task.id,
          user_id: task.user_id,
          channel: 'email',
          status: 'failed',
          message: `Falha no alerta por horário da tarefa: ${task.title}`,
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
        message: 'Alerta por horário da tarefa enviado',
        scheduled_for: scheduledFor,
        sent_at: new Date().toISOString(),
      })

      sent += 1
    }

    return NextResponse.json({
      success: true,
      today,
      nowHHMM,
      tasksFound: tasks?.length || 0,
      sent,
      errors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao executar alertas por horário da tarefa',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}