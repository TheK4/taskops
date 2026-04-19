'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runDailySummaryManually } from '@/app/dashboard/actions'

export default function RunDailySummaryButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRunSummary() {
    try {
      setLoading(true)

      const data = await runDailySummaryManually()

      console.log('Resultado do resumo diário:', data)

      router.refresh()
    } catch (error) {
      console.error('Erro ao executar resumo diário:', error)
      alert('Erro ao executar resumo diário.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRunSummary}
      disabled={loading}
      className="rounded-xl border px-4 py-2"
    >
      {loading ? 'Executando resumo...' : 'Executar resumo diário'}
    </button>
  )
}