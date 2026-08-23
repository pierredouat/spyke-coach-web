import { type ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 ml-60 p-8">
        {children}
      </main>
    </div>
  )
}
