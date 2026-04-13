import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold">TaskOps</h1>
        <p className="text-lg text-zinc-600">
          Gestão de tarefas recorrentes com alertas automáticos para equipes.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="rounded-xl px-5 py-3 bg-black text-white">
            Entrar
          </Link>
          <Link href="/cadastro" className="rounded-xl px-5 py-3 border">
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  )
}