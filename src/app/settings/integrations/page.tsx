'use client';

import { useEffect, useState } from 'react';

const AMO_CLIENT_ID = '36f61b3d-349d-48e8-850a-08ed66021ec6';
const AMO_REDIRECT_URI = 'https://dashboards.foryou-realestate.com/api/amo/oauth-callback';
const AMO_DOMAIN = 'reforyou.amocrm.ru';

const AMO_OAUTH_URL =
  `https://${AMO_DOMAIN}/oauth?client_id=${AMO_CLIENT_ID}` +
  `&state=dashboard_reauth&redirect_uri=${encodeURIComponent(AMO_REDIRECT_URI)}&response_type=code&mode=popup`;

type HealthData = {
  healthy: boolean;
  probeStatus: number;
  secondsToExpiry: number | null;
  isExpiringSoon: boolean | null;
  checkedAt: string;
};

export default function IntegrationsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/internal/amo-health')
      .then((r) => r.json())
      .then((d) => { setHealth(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const expiryText = () => {
    if (!health?.secondsToExpiry) return null;
    if (health.secondsToExpiry < 0) return `протух ${Math.abs(Math.round(health.secondsToExpiry / 3600))} год тому`;
    const h = Math.floor(health.secondsToExpiry / 3600);
    return `залишилось ~${h} год`;
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Інтеграції</h1>

      {/* AMO CRM */}
      <div className="border rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">AmoCRM</h2>
            <p className="text-sm text-gray-500">reforyou.amocrm.ru</p>
          </div>
          {loading ? (
            <span className="text-gray-400 text-sm">перевірка...</span>
          ) : health?.healthy ? (
            <span className="text-green-600 font-medium text-sm">✅ підключено</span>
          ) : (
            <span className="text-red-500 font-medium text-sm">❌ не підключено</span>
          )}
        </div>

        {health && (
          <div className="text-sm text-gray-500 mb-4 space-y-1">
            <div>Статус API: {health.probeStatus}</div>
            {expiryText() && <div>Токен: {expiryText()}</div>}
            <div className="text-xs">Перевірено: {new Date(health.checkedAt).toLocaleString('uk-UA')}</div>
          </div>
        )}

        <a
          href={AMO_OAUTH_URL}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {health?.healthy ? '🔄 Переавторизувати AMO' : '🔑 Підключити AMO'}
        </a>

        {!health?.healthy && (
          <p className="text-xs text-gray-400 mt-2">
            Натисніть кнопку → увійдіть в AMO → токени збережуться автоматично
          </p>
        )}
      </div>

      {/* Property Finder */}
      <div className="border rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Property Finder</h2>
            <p className="text-sm text-gray-500">atlas.propertyfinder.com</p>
          </div>
          <span className="text-green-600 font-medium text-sm">✅ статичні ключі</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Ключі живуть у GitHub Secrets. Токен отримується автоматично при кожному синку (30 хв expiry).
        </p>
      </div>

      {/* BigQuery */}
      <div className="border rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Google BigQuery</h2>
            <p className="text-sm text-gray-500">crypto-world-epta</p>
          </div>
          <span className="text-green-600 font-medium text-sm">✅ service account</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Service account key. Не протухає, оновлюється вручну.
        </p>
      </div>
    </div>
  );
}
