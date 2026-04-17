import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/logout-button'
import RunAlertsButton from '@/components/run-alerts-button'
import { updateDailySummarySettings } from '@/app/dashboard/actions'
import ExportCsvButton from '@/components/export-csv-button'
import ExportPdfButton from '@/components/export-pdf-button'
import DashboardCharts from '@/components/dashboard-charts'
import NotificationBell from '@/components/notification-bell'
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

type SearchParams = Promise<{
  user?: string
  status?: string
  period?: string
}>

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const selectedUserId = params.user || 'all'
  const selectedStatus = params.status || 'all'
  const selectedPeriod = params.period || 'all'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = getTodayInSaoPaulo()

  function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

let startDate: string | null = null

if (selectedPeriod === '7d') {
  startDate = getDateDaysAgo(7)
} else if (selectedPeriod === '30d') {
  startDate = getDateDaysAgo(30)
} else if (selectedPeriod === 'today') {
  startDate = today
}

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const isManagerView =
    profile?.role === 'admin' || profile?.role === 'manager'

  const profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, email, role')

  const { data: allProfiles } = isManagerView
    ? await profilesQuery
    : await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', user.id)

  let baseTasks = isManagerView
    ? supabase.from('tasks').select('*')
    : supabase.from('tasks').select('*').eq('user_id', user.id)

  if (isManagerView && selectedUserId !== 'all') {
    baseTasks = baseTasks.eq('user_id', selectedUserId)
  }

  if (selectedStatus !== 'all') {
    baseTasks = baseTasks.eq('status', selectedStatus)
  }

  if (startDate) {
  baseTasks = baseTasks.gte('created_at', startDate)
  }

  const { data: tasks } = await baseTasks.order('created_at', { ascending: false })

  const { data: logs } = isManagerView
    ? await supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    : await supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

const recentNotifications = (logs || []).map((log) => ({
  id: log.id,
  message: log.message,
  channel: log.channel,
  status: log.status,
  is_read: log.is_read ?? false,
}))

const unreadNotifications = recentNotifications.filter(
  (notification) => !notification.is_read
)

  const { data: activityLogs } = isManagerView
    ? await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    : await supabase
        .from('activity_logs')
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

  const totalTasks = (tasks || []).length
  const pendingTasksCount = (tasks || []).filter((t) => t.status === 'pending').length
  const overdueTasksCount = (tasks || []).filter((t) => t.status === 'overdue').length
  const doneTasksCount = (tasks || []).filter((t) => t.status === 'done').length

  function getUserLabel(userId: string) {
    const found = (allProfiles || []).find((p) => p.id === userId)
    if (!found) return 'Usuário'
    return found.full_name || found.email || 'Usuário'
  }

  const analytics = isManagerView
    ? (allProfiles || []).map((person) => {
        const userTasks = (tasks || []).filter((task) => task.user_id === person.id)

        return {
          id: person.id,
          name: person.full_name || person.email || 'Usuário',
          total: userTasks.length,
          pending: userTasks.filter((task) => task.status === 'pending').length,
          overdue: userTasks.filter((task) => task.status === 'overdue').length,
          done: userTasks.filter((task) => task.status === 'done').length,
        }
      })
    : []

  const totalRanking = [...analytics].sort((a, b) => b.total - a.total)
  const overdueRanking = [...analytics].sort((a, b) => b.overdue - a.overdue)
  const doneRanking = [...analytics].sort((a, b) => b.done - a.done)

  const userChartData = analytics.map((item) => ({
  id: item.id,
  name: item.name.length > 12 ? `${item.name.slice(0, 12)}...` : item.name,
  total: item.total,
  pending: item.pending,
  overdue: item.overdue,
  done: item.done,
}))

const statusChartData = [
  { name: 'Pendentes', value: pendingTasksCount },
  { name: 'Atrasadas', value: overdueTasksCount },
  { name: 'Concluídas', value: doneTasksCount },
]

  function buildDashboardUrl(
    userValue: string,
    statusValue: string,
    periodValue: string
  ) {
    const search = new URLSearchParams()

    if (userValue !== 'all') {
      search.set('user', userValue)
    }

    if (statusValue !== 'all') {
      search.set('status', statusValue)
    }

    if (periodValue !== 'all') {
      search.set('period', periodValue)
    }

    const query = search.toString()
    return query ? `/dashboard?${query}` : '/dashboard'
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl border p-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-zinc-600">
              Bem-vindo, {profile?.full_name || user.email}
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Perfil: {profile?.role || 'member'}
            </p>
          </div>

  <div className="flex items-center gap-3">
    <NotificationBell notifications={unreadNotifications} />
    <LogoutButton />
  </div>
</div>

        {isManagerView && (
          <div className="rounded-2xl border p-6 space-y-4">
            <h2 className="text-xl font-semibold">Filtros de gestão</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm text-zinc-500">Filtrar por usuário</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildDashboardUrl('all', selectedStatus, selectedPeriod)}
                    className={`rounded-lg px-3 py-2 text-sm border ${
                      selectedUserId === 'all'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black'
                    }`}
                  >
                    Todos
                  </Link>

                  {(allProfiles || []).map((person) => (
                    <Link
                      key={person.id}
                      href={buildDashboardUrl(person.id, selectedStatus, selectedPeriod)}
                      className={`rounded-lg px-3 py-2 text-sm border ${
                        selectedUserId === person.id
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black'
                      }`}
                    >
                      {person.full_name || person.email}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-zinc-500">Filtrar por status</p>
                <div className="flex flex-wrap gap-2">
                  {['all', 'pending', 'overdue', 'done'].map((status) => (
                    <Link
                      key={status}
                      href={buildDashboardUrl(selectedUserId, status, selectedPeriod)}
                      className={`rounded-lg px-3 py-2 text-sm border ${
                        selectedStatus === status
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black'
                      }`}
                    >
                      {status === 'all'
                        ? 'Todos'
                        : status === 'pending'
                        ? 'Pendentes'
                        : status === 'overdue'
                        ? 'Atrasadas'
                        : 'Concluídas'}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-zinc-500">Período</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'Tudo' },
                    { value: 'today', label: 'Hoje' },
                    { value: '7d', label: '7 dias' },
                    { value: '30d', label: '30 dias' },
                  ].map((period) => (
                    <Link
                      key={period.value}
                      href={buildDashboardUrl(selectedUserId, selectedStatus, period.value)}
                      className={`rounded-lg px-3 py-2 text-sm border ${
                        selectedPeriod === period.value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black'
                      }`}
                    >
                      {period.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Preferências de resumo diário</h2>
            <p className="text-sm text-zinc-500">
              Configure o envio automático do resumo das suas tarefas por email.
            </p>
          </div>

          <form
            action={updateDailySummarySettings}
            className="grid gap-4 md:grid-cols-3 md:items-end"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="daily_summary_enabled"
                defaultChecked={profile?.daily_summary_enabled ?? true}
              />
              <span className="text-sm">Receber resumo diário</span>
            </label>

            <div className="space-y-2">
              <p className="text-sm text-zinc-500">Horário do resumo</p>
              <input
                type="time"
                name="daily_summary_time"
                defaultValue={profile?.daily_summary_time?.slice(0, 5) || '08:00'}
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <button className="rounded-xl border px-4 py-2">
              Salvar preferência
            </button>
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-zinc-500">Total</p>
            <p className="text-2xl font-bold">{totalTasks}</p>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm text-zinc-500">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingTasksCount}</p>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm text-zinc-500">Atrasadas</p>
            <p className="text-2xl font-bold text-red-600">{overdueTasksCount}</p>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm text-zinc-500">Concluídas</p>
            <p className="text-2xl font-bold text-green-600">{doneTasksCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Resumo do dia</h2>
            <p className="text-sm text-zinc-500">
              Hoje: {today}
            </p>
          </div>

          <div className="flex gap-2">
            <ExportCsvButton
              userId={selectedUserId}
              status={selectedStatus}
              period={selectedPeriod}
            />
            <ExportPdfButton
              userId={selectedUserId}
              status={selectedStatus}
              period={selectedPeriod}
            />
            <RunAlertsButton />
          </div>
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
                        • {task.title} {isManagerView ? `— ${getUserLabel(task.user_id)}` : ''}
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
                        {isManagerView ? ` — ${getUserLabel(task.user_id)}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <Link href="/tasks" className="underline text-blue-600">
              Ir para tarefas
            </Link>

            {profile?.role === 'admin' && (
              <Link href="/dashboard/team" className="underline text-blue-600">
                Gerenciar equipe
              </Link>
            )}
          </div>
        </div>

        {isManagerView && (
          <DashboardCharts
            userAnalytics={userChartData}
            statusAnalytics={statusChartData}
          />
        )}

        {isManagerView && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-4">Mais tarefas</h2>

              {totalRanking.length > 0 ? (
                <div className="space-y-3">
                  {totalRanking.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Total: {item.total}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600">Sem dados.</p>
              )}
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-4">Mais atrasos</h2>

              {overdueRanking.length > 0 ? (
                <div className="space-y-3">
                  {overdueRanking.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Atrasadas: {item.overdue}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600">Sem dados.</p>
              )}
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-xl font-semibold mb-4">Mais concluídas</h2>

              {doneRanking.length > 0 ? (
                <div className="space-y-3">
                  {doneRanking.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Concluídas: {item.done}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600">Sem dados.</p>
              )}
            </div>
          </div>
        )}

        {isManagerView && (
          <div className="rounded-2xl border p-6">
            <h2 className="text-xl font-semibold mb-4">Visão da equipe</h2>

            {tasks && tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.slice(0, 12).map((task) => (
                  <div key={task.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-zinc-600">
                          {getUserLabel(task.user_id)}
                        </p>
                      </div>

                      <div className="text-sm text-zinc-500">
                        {task.start_date}
                      </div>
                    </div>

                    <div className="mt-2 text-sm">
                      <span
                        className={
                          task.status === 'done'
                            ? 'text-green-600'
                            : task.status === 'overdue'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-600">
                Nenhuma tarefa encontrada.
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-4">Notificações recentes</h2>

          {recentNotifications.length > 0 ? (
            <div className="space-y-3">
              {recentNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded-xl border p-4">
                  <p className="font-medium">{notification.message}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Canal: {notification.channel} • Status: {notification.status} • {notification.is_read ? 'Lida' : 'Não lida'}
                  </p>
                </div>
              ))}
        </div>
      ) : (
        <p className="text-zinc-600">
          Nenhuma notificação recente.
        </p>
      )}
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

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-4">Atividades recentes</h2>

          {activityLogs && activityLogs.length > 0 ? (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div key={log.id} className="rounded-xl border p-4">
                  <p className="font-medium">{log.description}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600">
              Nenhuma atividade registrada.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}