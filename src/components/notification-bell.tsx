'use client'

import { useEffect, useRef, useState } from 'react'

type NotificationItem = {
  id: string
  message: string
  channel: string
  status: string
}

type Props = {
  notifications: NotificationItem[]
}

export default function NotificationBell({ notifications }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const count = notifications.length

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-xl border px-4 py-2 text-sm font-medium bg-white hover:bg-zinc-50"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base">
            🔔
          </span>
          <span>Notificações</span>
        </span>

        {count > 0 && (
          <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full border bg-black px-2 text-xs text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-2xl border bg-white shadow-lg z-50">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">Notificações recentes</p>
            <p className="text-xs text-zinc-500">
              {count > 0
                ? `${count} notificação(ões) disponível(is)`
                : 'Nenhuma notificação'}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto p-3 space-y-3">
            {notifications.length > 0 ? (
              notifications.slice(0, 8).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-xl border p-3"
                >
                  <p className="text-sm font-medium">{notification.message}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Canal: {notification.channel} • Status: {notification.status}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border p-4 text-sm text-zinc-500">
                Nenhuma notificação recente.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}