import { User } from 'lucide-react';

export type PartnerId = 'klykov' | 'facebook';

type PartnerCardDefinition = {
  id: PartnerId;
  name: string;
  leads: string;
  deals: string;
  revenue: string;
  type: string;
  status: 'Active' | 'Paused';
  route: string;
  icon: typeof User;
};

export const PARTNER_HOME_PATHS: Record<PartnerId, string> = {
  klykov: '/partners/klykov',
  facebook: '/partners/facebook',
};

export const PARTNER_CARDS: PartnerCardDefinition[] = [
  {
    id: 'klykov',
    name: 'Klykov',
    leads: '1,245',
    deals: '42',
    revenue: 'AED 450,000',
    type: 'amoCRM Integration',
    status: 'Active',
    route: PARTNER_HOME_PATHS.klykov,
    icon: User,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    leads: 'Real Estate',
    deals: 'Oman Tag',
    revenue: 'AmoCRM',
    type: 'Campaign Mirror',
    status: 'Active',
    route: PARTNER_HOME_PATHS.facebook,
    icon: User,
  },
];

export function getPartnerHomePath(partnerId?: string) {
  if (!partnerId) return '/partners';
  return PARTNER_HOME_PATHS[partnerId as PartnerId] || '/partners';
}