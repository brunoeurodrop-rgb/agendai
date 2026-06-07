'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import {
  LayoutDashboard, Calendar, Plus, MessageCircle, Users,
  Scissors, UserCheck, Wallet, BarChart2, Bell, Star,
  LogOut, Menu, X, ChevronLeft, Percent, HelpCircle
} from 'lucide-react'
import TrialBanner from '@/components/TrialBanner'

const nav = [
  { label: 'Dashboard',     href: '/dashboard',    icon: LayoutDashboard, group: 'Principal' },
  { label: 'Agenda',        href: '/agenda',        icon: Calendar,        group: 'Principal' },
  { label: 'Novo agend.',   href: '/agendamento',   icon: Plus,            group: 'Principal' },
  { label: 'WhatsApp',      href: '/whatsapp',      icon: MessageCircle,   group: 'Principal' },
  { label: 'Clientes',      href: '/clientes',      icon: Users,           group: 'Cadastros' },
  { label: 'Serviços',      href: '/servicos',      icon: Scissors,        group: 'Cadastros' },
  { label: 'Profissionais', href: '/profissionais', icon: UserCheck,       group: 'Cadastros' },
  { label: 'Financeiro',    href: '/financeiro',    icon: Wallet,          group: 'Gestão' },
  { label: 'Comissões',     href: '/comissoes',     icon: Percent,         group: 'Gestão' },
  { label: 'Relatorios',    href: '/relatorios',    icon: BarChart2,       group: 'Gestão' },
  { label: 'Notificações',  href: '/notificacoes',  icon: Bell,            group: 'Gestão' },
]

const groups = ['Principal', 'Cadastros', 'Gestão']
const ROOT_PAGES = ['/dashboard']
const SUPORTE_URL = 'https://wa.me/5521990760217?text=Ol%C3%A1%2C+preciso+de+ajuda+com+o+AgendaAI'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [dateStr, setDateStr] = useState('')
  const showBack = !ROOT_PAGES.includes(pathname)

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100 w-52 shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="text-xl font-bold text-brand">Agenda<span className="text-gray-900">AI</span></div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-xs text-gray-400">WhatsApp ativo</span>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {groups.map(group => (
          <div key={group} className="mb-4">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">{group}</div>
            {nav.filter(n => n.group === group).map(item => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all ${
                    active ? 'bg-brand-light text-brand-dark font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}>
                  <Icon size={16} />{item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100 space-y-0.5">
        <Link href="/planos" onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900">
          <Star size={16} /> Planos
        </Link>
        <a href={SUPORTE_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-green-50 hover:text-green-700 transition-all">
          <HelpCircle size={16} className="text-green-500" />
          <span>Suporte</span>
          <span className="ml-auto text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">WhatsApp</span>
        </a>
        <button onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 w-full">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden md:flex"><Sidebar /></div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full"><Sidebar /></div>
        </div>
      )}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TrialBanner />
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-gray-500 hover:text-gray-900" onClick={() => setOpen(o => !o)}>
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            {showBack ? (
              <button onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition-colors group">
                <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Voltar
              </button>
            ) : (
              <div className="text-sm text-gray-400 hidden md:block" suppressHydrationWarning>{dateStr}</div>
            )}
          </div>
          <div className="md:hidden text-lg font-bold text-brand">Agenda<span className="text-gray-900">AI</span></div>
          <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark text-xs font-semibold flex items-center justify-center">BP</div>
        </div>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
