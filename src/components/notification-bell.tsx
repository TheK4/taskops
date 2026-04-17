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
  const count = notifications.length

  return (
    <div className="relative">
      <div className="rounded-xl border px-4 py-2 text-sm font-medium">
        Notificações
      </div>

      {count > 0 && (
        <div className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full border bg-black px-2 text-xs text-white">
          {count}
        </div>
      )}
    </div>
  )
}