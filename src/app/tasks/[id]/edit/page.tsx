import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateTask } from '@/app/tasks/actions'

type Props = {
  params: Promise<{ id: string }>
}

function minutesToDays(minutes: number | null) {
  if (!minutes || minutes <= 0) return 0
  return Math.floor(minutes / 1440)
}

export default async function EditTaskPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!task) {
    redirect('/tasks')
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Editar tarefa</h1>
          <Link href="/tasks" className="underline text-sm">
            Voltar
          </Link>
        </div>

        <form
          action={async (formData) => {
            'use server'
            await updateTask(id, formData)
          }}
          className="space-y-4 border p-4 rounded-xl"
        >
          <input
            name="title"
            defaultValue={task.title}
            placeholder="Nome da tarefa"
            required
            className="w-full border px-3 py-2 rounded"
          />

          <input
            name="description"
            defaultValue={task.description || ''}
            placeholder="Descrição"
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="date"
            name="due_date"
            defaultValue={task.start_date}
            required
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="time"
            name="due_time"
            defaultValue={task.due_time || ''}
            className="w-full border px-3 py-2 rounded"
          />

          <select
            name="recurrence"
            defaultValue={task.recurrence_type}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="none">Sem recorrência</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          <input
            type="number"
            name="day_of_month"
            defaultValue={task.recurrence_day_of_month || ''}
            placeholder="Dia do mês (ex: 25)"
            min="1"
            max="31"
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="number"
            name="remind_days_before"
            defaultValue={minutesToDays(task.remind_offset_minutes)}
            placeholder="Avisar quantos dias antes? (ex: 1)"
            min="0"
            className="w-full border px-3 py-2 rounded"
          />

          <select
            name="status"
            defaultValue={task.status}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="pending">Pendente</option>
            <option value="overdue">Atrasada</option>
            <option value="done">Concluída</option>
          </select>

          <button className="bg-black text-white px-4 py-2 rounded">
            Salvar alterações
          </button>
        </form>
      </div>
    </main>
  )
}