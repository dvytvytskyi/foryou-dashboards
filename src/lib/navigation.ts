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
} from 'lucide-react';

export const NAVIGATION_SECTIONS = [
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
    title: 'Отдел продаж',
    items: [
      { label: 'Обзор', icon: BarChart3, href: '/sales' },
      { label: 'Направления', icon: Compass, href: '/sales/directions' },
      { label: 'План/Факт', icon: Target, href: '/sales/plan-fact' },
      { label: 'Брокеры', icon: User, href: '/sales/brokers' },
    ],
  },
  {
    title: 'Партнеры',
    items: [
      { label: 'Партнеры', icon: Users, href: '/partners' },
    ],
  },
] as const;