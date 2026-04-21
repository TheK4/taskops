'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runTaskTimeAlertsManually } from '@/app/dashboard/actions'

export default function RunTaskTimeAlertsButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRun() {
    try {
      setLoading(true)

      const data = await runTaskTimeAlertsManually()

      console.log('Resultado dos alertas por horário:', data)

      router.refresh()
    } catch (error) {
      console.error('Erro ao executar alertas por horário:', error)
      alert('Erro ao executar alertas por horário.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRun}
      disabled={loading}
      className="rounded-xl border px-4 py-2"
    >
      {loading ? 'Executando alertas por horário...' : 'Executar alertas por horário'}
    </button>
  )
}