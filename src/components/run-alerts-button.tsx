'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runAlertsManually } from '@/app/dashboard/actions'

export default function RunAlertsButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRunAlerts() {
    try {
      setLoading(true)

      const data = await runAlertsManually()

      console.log('Resultado da varredura:', data)

      router.refresh()
    } catch (error) {
      console.error('Erro ao executar alertas:', error)
      alert('Erro ao executar varredura de alertas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRunAlerts}
      disabled={loading}
      className="rounded-xl border px-4 py-2"
    >
      {loading ? 'Executando alertas...' : 'Executar varredura de alertas'}
    </button>
  )
}