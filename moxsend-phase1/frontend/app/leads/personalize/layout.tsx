'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_ITEMS = [
  { label: 'AI Email Writer', href: '/leads/personalize' },
  { label: 'Personalization', href: '/leads/personalize/audience-mapping' },
  { label: 'Send Intelligence', href: '/leads/personalize/send-timing' },
  { label: 'Reply Intelligence', href: '/leads/personalize/reply-assistant' },
  { label: 'Activity Logs', href: '/leads/personalize/activity-logs' },
];

function SidebarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6v6H7z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function PersonalizeWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="personalize-shell flex min-h-screen flex-col">
      <header className="personalize-header sticky top-0 z-20 flex min-h-[3.25rem] shrink-0 items-center justify-between border-b px-3 py-2 backdrop-blur-sm sm:px-5">
        <Link
          href="/leads"
          className="personalize-back-link inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition"
        >
          <span aria-hidden="true">←</span>
          Back to Leads
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex min-h-0 flex-1 w-full gap-4 lg:gap-0">
        <aside className="personalize-sidebar sticky top-[3.25rem] z-10 hidden h-[calc(100dvh-3.25rem)] self-start w-72 flex-col border-r p-3 lg:flex">
          <div className="personalize-panel rounded-xl border p-3">
            <p className="personalize-muted text-[10px] uppercase tracking-[0.22em]">AI Workspace</p>
            <h2 className="mt-1 text-sm font-semibold">Outbound Command Center</h2>
          </div>
          <nav className="mt-3 flex-1 space-y-1.5 overflow-y-auto" aria-label="Personalize navigation">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition duration-200 ${
                    active
                      ? 'border-[#38BDF8]/70 bg-[#081522] text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_0_20px_rgba(0,200,255,0.2)]'
                      : 'border-transparent bg-transparent text-[#6B8CA5] hover:border-[#38BDF8]/30 hover:bg-[#081522]/80 hover:text-[#D6F3FF]'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full transition ${
                      active ? 'bg-[#00C8FF]' : 'bg-transparent group-hover:bg-[#38BDF8]/45'
                    }`}
                  />
                  <span className={`${active ? 'text-[#00C8FF]' : 'text-[#6B8CA5] group-hover:text-[#38BDF8]'}`}>
                    <SidebarIcon />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="personalize-panel personalize-muted rounded-xl border p-3 text-xs">
            Smooth AI-assisted drafting with cohort personalization.
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-3 py-3 sm:px-5 sm:py-5">
          <div className="personalize-panel mb-3 flex gap-2 overflow-x-auto rounded-xl border p-2 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs transition ${
                    active
                      ? 'border-[#38BDF8]/70 bg-[#081522] text-white shadow-[0_0_16px_rgba(0,200,255,0.18)]'
                      : 'border-[#38BDF8]/25 bg-[#081522]/60 text-[#6B8CA5]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="personalize-panel animate-[fadeIn_320ms_ease-out] rounded-2xl border p-3 sm:p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
