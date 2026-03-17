import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api';

const client = axios.create({
    baseURL: API_BASE,
});

export const api = {
    // Dashboard
    getStats: () => client.get('/dashboard/stats'),

    // Test Suites
    getTestSuites: () => client.get('/test-suites'),
    createTestSuite: (data) => client.post('/test-suites', data),
    deleteTestSuite: (id) => client.delete(`/test-suites/${id}`),

    // Test Cases
    getTestCases: (suiteId) => client.get('/test-cases', { params: { suite_id: suiteId } }),
    getTestCase: (id) => client.get(`/test-cases/${id}`),
    createTestCase: (data) => client.post('/test-cases', data),
    updateTestCase: (id, data) => client.put(`/test-cases/${id}`, data),
    deleteTestCase: (id) => client.delete(`/test-cases/${id}`),

    // Locators
    getLocators: () => client.get('/locators'),
    createLocator: (data) => client.post('/locators', data),
    updateLocator: (id, data) => client.put(`/locators/${id}`, data),
    deleteLocator: (id) => client.delete(`/locators/${id}`),

    // Executions
    getExecutions: () => client.get('/executions'),
    runExecution: (data) => client.post('/executions/run', data),
    getExecution: (id) => client.get(`/executions/${id}`),

    // Templates
    getTemplates: () => client.get('/templates'),
    applyTemplate: (templateId, suiteId) => client.post(`/templates/${templateId}/apply`, { suite_id: suiteId }),

    // Scripts & Docs
    generateScript: (data) => client.post('/scripts/generate', data),
    generateDocs: (caseId) => client.post('/docs/generate', { test_case_id: caseId }),
};
