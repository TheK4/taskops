import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/logout-button'
import RunAlertsButton from '@/components/run-alerts-button'
import Link from 'next/link'

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

function addDaysToYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function minutesToDays(minutes: number | null) {
  if (!minutes || minutes <= 0) return null
  return Math.floor(minutes / 1440)
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = getTodayInSaoPaulo()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)

  const { data: logs } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const activeTasks = (tasks || []).filter((t) => t.status !== 'done')

  const dueTodayTasks = activeTasks.filter((t) => t.start_date === today)

  const alertTodayTasks = activeTasks.filter((t) => {
    if (!t.remind_offset_minutes || t.remind_offset_minutes <= 0) return false

    const remindDays = Math.floor(t.remind_offset_minutes / 1440)
    const alertDate = addDaysToYMD(t.start_date, -remindDays)

    return alertDate === today
  })

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl border p-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-zinc-600">
              Bem-vindo, {user.email}
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="rounded-2xl border p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Resumo do dia</h2>
              <p className="text-sm text-zinc-500">
                Hoje: {today}
              </p>
            </div>

            <RunAlertsButton />
          </div>

          {dueTodayTasks.length === 0 && alertTodayTasks.length === 0 ? (
            <p className="text-zinc-600">
              Nenhum alerta calculado para hoje.
            </p>
          ) : (
            <div className="space-y-4">
              {dueTodayTasks.length > 0 && (
                <div>
                  <p className="font-medium">Vencem hoje:</p>
                  <ul className="text-sm text-zinc-700 mt-1 space-y-1">
                    {dueTodayTasks.map((task) => (
                      <li key={task.id}>
                        • {task.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {alertTodayTasks.length > 0 && (
                <div>
                  <p className="font-medium">Avisos:</p>
                  <ul className="text-sm text-zinc-700 mt-1 space-y-1">
                    {alertTodayTasks.map((task) => (
                      <li key={task.id}>
                        • {task.title} — vence em {minutesToDays(task.remind_offset_minutes)} dia(s)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <Link href="/tasks" className="underline text-blue-600">
              Ir para tarefas
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-4">Últimos alertas gerados</h2>

          {logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-xl border p-4">
                  <p className="font-medium">{log.message}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Canal: {log.channel} • Status: {log.status}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600">
              Nenhum alerta registrado ainda.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}