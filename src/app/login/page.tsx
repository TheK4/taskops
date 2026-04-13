import Link from 'next/link'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Entrar</h1>
        <p className="text-sm text-zinc-600 mb-6">
          Faça login para acessar suas tarefas.
        </p>

        {params.error ? (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        ) : null}

        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border px-4 py-3 outline-none"
              placeholder="voce@empresa.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Senha</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border px-4 py-3 outline-none"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-3 text-white"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-sm text-zinc-600">
          Não tem conta?{' '}
          <Link href="/cadastro" className="font-medium underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  )
}