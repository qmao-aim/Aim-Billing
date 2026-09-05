import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { SyncBanner } from './SyncBanner'

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#main"
        className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[6px] focus:bg-surface focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:shadow-e2"
      >
        Skip to content
      </a>
      <Header />
      <SyncBanner />
      <main id="main" className="w-full flex-1 px-6 py-7">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
