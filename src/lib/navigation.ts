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
  Briefcase
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
      { label: 'Overview', icon: BarChart3, href: '/sales' },
      { label: 'Directions', icon: Compass, href: '/sales/directions' },
      { label: 'Plan/Fact', icon: Target, href: '/sales/plan-fact' },
      { label: 'Brokers', icon: User, href: '/sales/brokers' },
    ],
  },
  {
    title: 'Partners',
    items: [
      { label: 'Klykov', icon: User, href: '/partners/klykov' },
      { label: 'Facebook Oman', icon: Facebook, href: '/partners/facebook' },
      { label: 'All Partners', icon: Users, href: '/partners' },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'System Map (AS-IS)', icon: Briefcase, href: '/developer' },
    ],
  },
] as const;