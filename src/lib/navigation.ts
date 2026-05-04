import {
  BarChart3,
  Compass,
  Facebook,
  FileText,
  Globe,
  Megaphone,
  Target,
  User,
  Users,
  Zap,
  Briefcase,
  Wallet,
  Settings,
} from 'lucide-react';

export const NAVIGATION_SECTIONS = [
  {
    title: 'Отдел продаж',
    items: [
      { label: 'Overview', icon: BarChart3, href: '/sales' },
      { label: 'Directions', icon: Compass, href: '/sales/directions' },
      { label: 'Plan/Fact', icon: Target, href: '/sales/plan-fact' },
      { label: 'Brokers', icon: User, href: '/sales/brokers' },
    ],
  },
  {
    title: 'Сделки компании',
    items: [
      { label: 'Итоги', icon: Briefcase, href: '/company-deals' },
      { label: 'Рейтинги', icon: BarChart3, href: '/company-deals/ratings' },
      { label: 'Альянс', icon: Users, href: '/company-deals/alliance' },
    ],
  },
  {
    title: 'Партнеры',
    items: [
      { label: 'Klykov', icon: User, href: '/partners/klykov' },
      { label: 'Facebook Oman', icon: Facebook, href: '/partners/facebook' },
    ],
  },
  {
    title: 'Расходы',
    items: [
      { label: 'Обзор', icon: Wallet, href: '/expenses/overview' },
    ],
  },
  {
    title: 'Инвойсы',
    items: [
      { label: 'Обзор', icon: FileText, href: '/invoices/overview' },
    ],
  },
  {
    title: 'Маркетинг',
    items: [
      { label: 'Marketing', icon: Megaphone, href: '/marketing' },
      { label: 'RED', icon: Zap, href: '/red' },
      { label: 'Facebook_Target point', icon: Facebook, href: '/facebook' },
      { label: 'Website', icon: Globe, href: '/website' },
      { label: 'Property Finder', icon: FileText, href: '/property-finder' },
    ],
  },
  {
    title: 'Система',
    items: [
      { label: 'Інтеграції', icon: Settings, href: '/settings/integrations' },
    ],
  },
] as const;