export interface ScenarioWindow {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    tags?: string[];
}

export const SCENARIO_LIBRARY: ScenarioWindow[] = [
    {
        id: 'volmageddon_2018',
        name: 'Volmageddon',
        description: 'Volatility shock and equity drawdown (approx. early Feb 2018).',
        startDate: '2018-02-05',
        endDate: '2018-02-09',
        tags: ['volatility', 'shock', 'risk-off']
    },
    {
        id: 'covid_crash_2020',
        name: 'Covid Crash',
        description: 'Pandemic-driven selloff (approx. Feb 2020 peak to Mar 2020 trough).',
        startDate: '2020-02-20',
        endDate: '2020-03-23',
        tags: ['crash', 'macro', 'risk-off']
    },
    {
        id: 'ai_boom_2023',
        name: 'AI Boom',
        description: 'AI-led momentum regime (approx. first half of 2023).',
        startDate: '2023-01-03',
        endDate: '2023-06-16',
        tags: ['momentum', 'risk-on', 'growth']
    }
];

export function getScenarioById(id: string) {
    return SCENARIO_LIBRARY.find((scenario) => scenario.id === id) || null;
}
