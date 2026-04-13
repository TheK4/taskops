'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTask(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const title = String(formData.get('title') || '')
  const description = String(formData.get('description') || '')
  const dueDate = String(formData.get('due_date') || '')
  const recurrence = String(formData.get('recurrence') || 'none')
  const dayOfMonth = Number(formData.get('day_of_month') || 0)
  const remindDaysBefore = Number(formData.get('remind_days_before') || 0)

  const remindOffsetMinutes =
    remindDaysBefore > 0 ? remindDaysBefore * 24 * 60 : 0

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title,
    description,
    start_date: dueDate,
    recurrence_type: recurrence,
    recurrence_day_of_month: dayOfMonth || null,
    remind_offset_minutes: remindOffsetMinutes,
    status: 'pending',
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function completeTask(taskId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done' })
    .eq('id', taskId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/tasks')
}