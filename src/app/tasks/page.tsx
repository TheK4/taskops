import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createTask, completeTask, deleteTask } from './actions'

type SearchParams = Promise<{
  status?: string
}>

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

function addMonthsToYMD(ymd: string, months: number) {
  const date = parseYMDToLocalDate(ymd)
  date.setMonth(date.getMonth() + months)
  return formatDateToYMD(date)
}

function minutesToDays(minutes: number | null) {
  if (!minutes || minutes <= 0) return null
  return Math.floor(minutes / 1440)
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const currentStatus = params.status || 'all'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isManagerView =
    profile?.role === 'admin' || profile?.role === 'manager'

  const { data: teamProfiles } = isManagerView
    ? await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name', { ascending: true })
    : { data: [] }

  const today = getTodayInSaoPaulo()

  await supabase
    .from('tasks')
    .update({ status: 'overdue' })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .lt('start_date', today)

  const { data: recurringTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .neq('recurrence_type', 'none')

  for (const task of recurringTasks || []) {
    const taskDate = task.start_date as string

    if (taskDate < today && task.status !== 'done') {
      let nextDateString = taskDate

      if (task.recurrence_type === 'daily') {
        nextDateString = addDaysToYMD(taskDate, 1)
      }

      if (task.recurrence_type === 'weekly') {
        nextDateString = addDaysToYMD(taskDate, 7)
      }

      if (task.recurrence_type === 'monthly') {
        if (task.recurrence_day_of_month) {
          const todayDate = parseYMDToLocalDate(today)
          const next = new Date(
            todayDate.getFullYear(),
            todayDate.getMonth() + 1,
            task.recurrence_day_of_month
          )
          nextDateString = formatDateToYMD(next)
        } else {
          nextDateString = addMonthsToYMD(taskDate, 1)
        }
      }

      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', task.title)
        .eq('start_date', nextDateString)
        .eq('recurrence_type', task.recurrence_type)
        .maybeSingle()

      if (!existingTask) {
        await supabase.from('tasks').insert({
          user_id: user.id,
          title: task.title,
          description: task.description,
          start_date: nextDateString,
          recurrence_type: task.recurrence_type,
          recurrence_day_of_month: task.recurrence_day_of_month,
          remind_offset_minutes: task.remind_offset_minutes,
          status: 'pending',
        })
      }

      await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', task.id)
    }
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (currentStatus !== 'all') {
    query = query.eq('status', currentStatus)
  }

  const { data: tasks } = await query

  const activeTasks = (tasks || []).filter((task) => task.status !== 'done')
  const dueTodayTasks = activeTasks.filter((task) => task.start_date === today)

  const alertTodayTasks = activeTasks.filter((task) => {
    if (!task.remind_offset_minutes || task.remind_offset_minutes <= 0) {
      return false
    }

    const remindDays = Math.floor(task.remind_offset_minutes / 1440)
    const alertDate = addDaysToYMD(task.start_date, -remindDays)

    return alertDate === today
  })

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Minhas tarefas</h1>
          <Link href="/dashboard" className="text-sm underline">
            Voltar ao dashboard
          </Link>
        </div>

        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Alertas de hoje</h2>
          <div className="text-xs text-zinc-600">Hoje: {today}</div>

          {dueTodayTasks.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-zinc-800">Vencem hoje:</p>
              <ul className="mt-1 text-sm text-zinc-700 space-y-1">
                {dueTodayTasks.map((task) => (
                  <li key={`due-${task.id}`}>• {task.title} — vence hoje</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Nenhuma tarefa vence hoje.</p>
          )}

          {alertTodayTasks.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-zinc-800">Avisos para hoje:</p>
              <ul className="mt-1 text-sm text-zinc-700 space-y-1">
                {alertTodayTasks.map((task) => (
                  <li key={`alert-${task.id}`}>
                    • {task.title} — vence em {minutesToDays(task.remind_offset_minutes)} dia(s)
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Nenhum aviso para hoje.</p>
          )}
        </div>

        <form action={createTask} className="space-y-4 border p-4 rounded-xl">
          {isManagerView && (
            <select
              name="assigned_user_id"
              defaultValue={user.id}
              className="w-full border px-3 py-2 rounded"
            >
              {(teamProfiles || []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.email} {member.role ? `(${member.role})` : ''}
                </option>
              ))}
            </select>
          )}

          <input
            name="title"
            placeholder="Nome da tarefa"
            required
            className="w-full border px-3 py-2 rounded"
          />

          <input
            name="description"
            placeholder="Descrição"
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="date"
            name="due_date"
            required
            className="w-full border px-3 py-2 rounded"
          />

          <select name="recurrence" className="w-full border px-3 py-2 rounded">
            <option value="none">Sem recorrência</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          <input
            type="number"
            name="day_of_month"
            placeholder="Dia do mês (ex: 25)"
            min="1"
            max="31"
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="number"
            name="remind_days_before"
            placeholder="Avisar quantos dias antes? (ex: 1)"
            min="0"
            className="w-full border px-3 py-2 rounded"
          />

          <button className="bg-black text-white px-4 py-2 rounded">
            Criar tarefa
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/tasks?status=all"
            className={`rounded-lg px-3 py-2 text-sm border ${
              currentStatus === 'all' ? 'bg-black text-white border-black' : 'bg-white text-black'
            }`}
          >
            Todas
          </Link>

          <Link
            href="/tasks?status=pending"
            className={`rounded-lg px-3 py-2 text-sm border ${
              currentStatus === 'pending' ? 'bg-black text-white border-black' : 'bg-white text-black'
            }`}
          >
            Pendentes
          </Link>

          <Link
            href="/tasks?status=done"
            className={`rounded-lg px-3 py-2 text-sm border ${
              currentStatus === 'done' ? 'bg-black text-white border-black' : 'bg-white text-black'
            }`}
          >
            Concluídas
          </Link>

          <Link
            href="/tasks?status=overdue"
            className={`rounded-lg px-3 py-2 text-sm border ${
              currentStatus === 'overdue' ? 'bg-black text-white border-black' : 'bg-white text-black'
            }`}
          >
            Atrasadas
          </Link>
        </div>

        <div className="space-y-3">
          {tasks && tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task.id}
                className="border p-4 rounded-xl flex justify-between items-center gap-4"
              >
                <div className="flex-1">
                  <p
                    className={`font-semibold ${
                      task.status === 'done'
                        ? 'line-through text-zinc-400'
                        : task.status === 'overdue'
                        ? 'text-red-600'
                        : ''
                    }`}
                  >
                    {task.title}
                  </p>

                  <p className="text-sm text-zinc-600">{task.description}</p>

                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>Data: {task.start_date}</span>
                    <span>
                      Recorrência:{' '}
                      {task.recurrence_type === 'none'
                        ? 'Sem recorrência'
                        : task.recurrence_type === 'daily'
                        ? 'Diária'
                        : task.recurrence_type === 'weekly'
                        ? 'Semanal'
                        : 'Mensal'}
                    </span>
                    {task.recurrence_day_of_month && (
                      <span>Dia fixo: {task.recurrence_day_of_month}</span>
                    )}
                    {minutesToDays(task.remind_offset_minutes) && (
                      <span>
                        Aviso: {minutesToDays(task.remind_offset_minutes)} dia(s) antes
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`text-sm font-medium ${
                      task.status === 'done'
                        ? 'text-green-600'
                        : task.status === 'overdue'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {task.status}
                  </span>

                  <div className="flex gap-2">
                    {task.status !== 'done' && (
                      <form
                        action={async () => {
                          'use server'
                          await completeTask(task.id)
                        }}
                      >
                        <button className="bg-green-600 text-white px-3 py-1 rounded">
                          Concluir
                        </button>
                      </form>
                    )}

                    <Link
                      href={`/tasks/${task.id}/edit`}
                      className="border px-3 py-1 rounded"
                    >
                      Editar
                    </Link>

                    <form
                      action={async () => {
                        'use server'
                        await deleteTask(task.id)
                      }}
                    >
                      <button className="bg-red-600 text-white px-3 py-1 rounded">
                        Excluir
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="border rounded-xl p-6 text-center text-zinc-500">
              Nenhuma tarefa encontrada nesse filtro.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}