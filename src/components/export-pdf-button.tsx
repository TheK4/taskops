'use client'

type Props = {
  userId: string
  status: string
  period: string
}

export default function ExportPdfButton({ userId, status, period }: Props) {
  function handleExport() {
    const params = new URLSearchParams()

    if (userId && userId !== 'all') {
      params.set('user', userId)
    }

    if (status && status !== 'all') {
      params.set('status', status)
    }

    if (period && period !== 'all') {
      params.set('period', period)
    }

    const query = params.toString()
    const url = query ? `/api/export-report?${query}` : '/api/export-report'

    window.open(url, '_blank')
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-xl border px-4 py-2"
    >
      Exportar PDF
    </button>
  )
}