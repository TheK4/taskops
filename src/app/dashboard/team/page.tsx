import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateUserRole } from '@/app/dashboard/actions'

export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (currentProfile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('user_id, status')

  function getTaskCount(userId: string) {
    return (tasks || []).filter((task) => task.user_id === userId).length
  }

  function getPendingCount(userId: string) {
    return (tasks || []).filter(
      (task) => task.user_id === userId && task.status === 'pending'
    ).length
  }

  function getOverdueCount(userId: string) {
    return (tasks || []).filter(
      (task) => task.user_id === userId && task.status === 'overdue'
    ).length
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Equipe</h1>
            <p className="text-zinc-600">
              Gestão de usuários e papéis do sistema.
            </p>
          </div>

          <Link href="/dashboard" className="underline text-sm">
            Voltar ao dashboard
          </Link>
        </div>

        <div className="space-y-4">
          {profiles && profiles.length > 0 ? (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl border p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {profile.full_name || 'Sem nome'}
                  </p>
                  <p className="text-sm text-zinc-600">{profile.email}</p>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>Total tasks: {getTaskCount(profile.id)}</span>
                    <span>Pendentes: {getPendingCount(profile.id)}</span>
                    <span>Atrasadas: {getOverdueCount(profile.id)}</span>
                  </div>
                </div>

                <form
                  action={async (formData) => {
                    'use server'
                    const role = String(formData.get('role') || 'member')
                    await updateUserRole(profile.id, role)
                  }}
                  className="flex items-center gap-2"
                >
                  <select
                    name="role"
                    defaultValue={profile.role || 'member'}
                    className="border px-3 py-2 rounded"
                  >
                    <option value="member">member</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>

                  <button className="bg-black text-white px-4 py-2 rounded">
                    Salvar
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border p-6 text-zinc-600">
              Nenhum usuário encontrado.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}