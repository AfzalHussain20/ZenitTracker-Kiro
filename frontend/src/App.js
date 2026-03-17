import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TestSuites from './components/TestSuites';
import Recorder from './components/Recorder';
import Inspector from './components/Inspector';
import ScriptView from './components/ScriptView';
import TestRunner from './components/TestRunner';
import Templates from './components/Templates';
import Documentation from './components/Documentation';
import LocatorManager from './components/LocatorManager';
import { Toaster } from 'sonner';

function App() {
    return (
        <Router>
            <Layout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/suites" element={<TestSuites />} />
                    <Route path="/recorder" element={<Recorder />} />
                    <Route path="/inspector" element={<Inspector />} />
                    <Route path="/scripts" element={<ScriptView />} />
                    <Route path="/runner" element={<TestRunner />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/docs" element={<Documentation />} />
                    <Route path="/locators" element={<LocatorManager />} />
                </Routes>
            </Layout>
            <Toaster position="top-right" theme="dark" richColors closeButton />
        </Router>
    );
}

export default App;
