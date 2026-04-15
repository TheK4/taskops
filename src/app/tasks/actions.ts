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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isManagerView =
    profile?.role === 'admin' || profile?.role === 'manager'

  const assignedUserId = String(formData.get('assigned_user_id') || '')
  const targetUserId = isManagerView && assignedUserId ? assignedUserId : user.id

  const title = String(formData.get('title') || '')
  const description = String(formData.get('description') || '')
  const dueDate = String(formData.get('due_date') || '')
  const recurrence = String(formData.get('recurrence') || 'none')
  const dayOfMonth = Number(formData.get('day_of_month') || 0)
  const remindDaysBefore = Number(formData.get('remind_days_before') || 0)

  const remindOffsetMinutes =
    remindDaysBefore > 0 ? remindDaysBefore * 24 * 60 : 0

  const { data: insertedTask, error } = await supabase
    .from('tasks')
    .insert({
      user_id: targetUserId,
      title,
      description,
      start_date: dueDate,
      recurrence_type: recurrence,
      recurrence_day_of_month: dayOfMonth || null,
      remind_offset_minutes: remindOffsetMinutes,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    task_id: insertedTask.id,
    action: 'create',
    description: `Criou tarefa "${title}"`,
  })

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      task_id: taskId,
      action: 'complete',
      description: 'Concluiu tarefa',
    })
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', taskId)
    .maybeSingle()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    throw new Error(error.message)
  }

  if (user) {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      task_id: null,
      action: 'delete',
      description: `Excluiu tarefa "${task?.title || ''}"`,
    })
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

export async function updateTask(taskId: string, formData: FormData) {
  const supabase = await createClient()

  const title = String(formData.get('title') || '')
  const description = String(formData.get('description') || '')
  const dueDate = String(formData.get('due_date') || '')
  const recurrence = String(formData.get('recurrence') || 'none')
  const dayOfMonth = Number(formData.get('day_of_month') || 0)
  const remindDaysBefore = Number(formData.get('remind_days_before') || 0)
  const status = String(formData.get('status') || 'pending')

  const remindOffsetMinutes =
    remindDaysBefore > 0 ? remindDaysBefore * 24 * 60 : 0

  const { error } = await supabase
    .from('tasks')
    .update({
      title,
      description,
      start_date: dueDate,
      recurrence_type: recurrence,
      recurrence_day_of_month: dayOfMonth || null,
      remind_offset_minutes: remindOffsetMinutes,
      status,
    })
    .eq('id', taskId)

  if (error) {
    throw new Error(error.message)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      task_id: taskId,
      action: 'update',
      description: 'Atualizou tarefa',
    })
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  redirect('/tasks')
}