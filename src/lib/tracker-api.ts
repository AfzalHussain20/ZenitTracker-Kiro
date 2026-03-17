import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const trackerApi = {
    // Dashboard
    getStats: () => api.get('/dashboard/stats'),

    // Test Suites
    getSuites: () => api.get('/test-suites'),
    getSuite: (id: string) => api.get(`/test-suites/${id}`),
    createSuite: (data: any) => api.post('/test-suites', data),
    updateSuite: (id: string, data: any) => api.put(`/test-suites/${id}`, data),
    deleteSuite: (id: string) => api.delete(`/test-suites/${id}`),

    // Test Cases
    getCases: (suiteId?: string) => api.get('/test-cases', { params: { suite_id: suiteId } }),
    getCase: (id: string) => api.get(`/test-cases/${id}`),
    createCase: (data: any) => api.post('/test-cases', data),
    updateCase: (id: string, data: any) => api.put(`/test-cases/${id}`, data),
    deleteCase: (id: string) => api.delete(`/test-cases/${id}`),

    // Locators
    getLocators: () => api.get('/locators'),
    createLocator: (data: any) => api.post('/locators', data),
    updateLocator: (id: string, data: any) => api.put(`/locators/${id}`, data),
    deleteLocator: (id: string) => api.delete(`/locators/${id}`),

    // Executions
    getExecutions: () => api.get('/executions'),
    runExecution: (caseId: string) => api.post('/executions/run', { test_case_id: caseId }),

    // Templates
    getTemplates: () => api.get('/templates'),
    applyTemplate: (data: any) => api.post('/templates/apply', data),

    // Documentation & Scripts
    generateScript: (caseId: string, language: string) => api.post(`/scripts/generate`, { test_case_id: caseId, language }),
    generateDoc: (caseId: string) => api.post(`/docs/generate`, { test_case_id: caseId }),
};
