// Test broker name resolution logic

function normalizeBrokerKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

const BROKER_DB_TO_PLAN: Record<string, string> = {
  'valeria bogdanova': 'валерия богданова',
  'богданова валерия': 'валерия богданова',
  'артем герасимов': 'artem gerasimov',
  'радик погосян': 'radik pogosyan',
  'radik': 'radik pogosyan',
  'cb radik': 'radik pogosyan',
  'diana rustam': 'диана рустам кызы',
  'диана': 'диана рустам кызы',
  'гульноза': 'рахимова гульноза алишеровна',
  'gulnoza': 'рахимова гульноза алишеровна',
  'кристина': 'кристина нохрина',
  'алексей клыков': 'alexey klykov',
  'руслан абдуллаев': 'абдуллаев руслан',
  'даниил невзоров': 'daniil nevzorov',
  'невзоров даниил': 'daniil nevzorov',
  'ekaterina spitsyna': 'екатерина спицына',
  'ekaterina spytsina': 'екатерина спицына',
  'ekaterina nbd': 'екатерина спицына',
  'kamila': 'камила евстегнеева',
  'kamilla': 'камила евстегнеева',
  'яна': 'яна',
  'yana': 'яна',
};

const planNames = [
  'Светлана', 'Daniil Nevzorov', 'Валерия Богданова', 'Екатерина Спицына',
  'Камила Евстегнеева', 'Ирина Кольчугина', 'Абдуллаев Руслан', 'Artem Gerasimov',
  'Radik Pogosyan', 'Диана Рустам Кызы', 'Динара Исаева', 'Кристина Нохрина',
  'Dima', 'Рахимова Гульноза Алишеровна', 'Tatsiana Hidrevich', 'Alexey Klykov',
];

const planIndex = new Map(planNames.map(n => [normalizeBrokerKey(n), n]));

// DB broker names to test
const dbBrokers = [
  'Daniil Nevzorov', 'Daniil Nevzorov/ Diana Rustam', 'Diana Rustam',
  'Ekaterina Spitsyna', 'Ekaterina Spytsina', 'Ekaterina NBD',
  'Valeria Bogdanova', 'Valeria Bogdanova/ Diana R', 'Богданова Валерия',
  'Артем Герасимов', 'Radik Pogosyan', 'Радик Погосян', 'Radik', 'CB (Radik)',
  'Диана Рустам Кызы', 'Diana Rustam', 'Диана',
  'Гульноза', 'Gulnoza', 'Рахимова Гульноза Алишеровна',
  'Кристина', 'Кристина Нохрина',
  'Алексей Клыков', 'Абдуллаев Руслан', 'Руслан Абдуллаев',
  'Камила Евстегнеева', 'Kamila', 'Kamilla',
  'Даниил Невзоров', 'Невзоров Даниил',
  'Дима', 'Tatsiana Hidrevich', 'Ирина Кольчугина', 'Динара Исаева', 'Светлана',
  'Яна',
];

function resolveBrokerPlan(brokerName: string) {
  const key = normalizeBrokerKey(brokerName);
  if (planIndex.has(key)) return planIndex.get(key) + ' [DIRECT]';
  const mappedKey = BROKER_DB_TO_PLAN[key];
  if (mappedKey && planIndex.has(mappedKey)) return planIndex.get(mappedKey) + ' [ALIAS]';
  const firstWord = key.split(' ')[0];
  if (firstWord.length >= 4) {
    for (const [planKey, planVal] of planIndex.entries()) {
      if (planKey.startsWith(firstWord) || planKey.includes(` ${firstWord}`)) {
        return planVal + ' [PARTIAL]';
      }
    }
  }
  return 'NO MATCH';
}

for (const broker of dbBrokers) {
  const result = resolveBrokerPlan(broker);
  console.log(`${broker.padEnd(40)} → ${result}`);
}
