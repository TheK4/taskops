'use client'

type Props = {
  userId: string
  status: string
}

export default function ExportCsvButton({ userId, status }: Props) {
  function handleExport() {
    const params = new URLSearchParams()

    if (userId && userId !== 'all') {
      params.set('user', userId)
    }

    if (status && status !== 'all') {
      params.set('status', status)
    }

    const query = params.toString()
    const url = query ? `/api/export-tasks?${query}` : '/api/export-tasks'

    window.open(url, '_blank')
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-xl border px-4 py-2"
    >
      Exportar CSV
    </button>
  )
}