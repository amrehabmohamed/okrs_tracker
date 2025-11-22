const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const EMAIL = 'test@example.com'; // Use a test user
const PASSWORD = 'Password123!'; // Ensure this matches the test user's password

async function runTests() {
    console.log('🚀 Starting Phase 4 Verification...');

    try {
        // 1. Login
        console.log('\n🔑 Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.data.token;
        const userId = loginRes.data.data.user.id;
        console.log('✅ Login successful');

        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Get an Active OKR (or create one if needed - assuming one exists for now)
        console.log('\n🔍 Fetching OKRs...');
        const okrsRes = await axios.get(`${API_URL}/okrs`, authHeaders);
        const okr = okrsRes.data.data.find(o => o.status !== 3); // Not archived
        if (!okr) throw new Error('No active OKR found. Please create one first.');
        console.log(`✅ Found OKR: ${okr.okr_title} (${okr.id})`);

        // 3. Create a KPI Component (Count Type)
        console.log('\n📊 Creating KPI Component (Count)...');
        const componentRes = await axios.post(`${API_URL}/kpi-components`, {
            okr_id: okr.id,
            component_name: `Test Count Component ${Date.now()}`,
            component_weight: 10,
            measurement_type: 0, // Count
            target_value: 100,
            unit: 'items'
        }, authHeaders);
        const componentId = componentRes.data.data.id;
        console.log(`✅ Created Component: ${componentId}`);

        // 4. Submit Data (Version 1)
        console.log('\n📝 Submitting Data (Version 1)...');
        const submitRes1 = await axios.post(`${API_URL}/kpi-data`, {
            kpi_component_id: componentId,
            value: 50,
            evidence_link: 'https://example.com/evidence1',
            notes: 'First submission'
        }, authHeaders);

        if (submitRes1.data.data.version_number !== 1) throw new Error('Expected version 1');
        if (submitRes1.data.data.status !== 0) throw new Error('Expected status 0 (pending)');
        console.log('✅ Submission V1 successful');

        // 5. Resubmit Data (Version 2)
        console.log('\n📝 Resubmitting Data (Version 2)...');
        const submitRes2 = await axios.post(`${API_URL}/kpi-data`, {
            kpi_component_id: componentId,
            value: 75,
            evidence_link: 'https://example.com/evidence2',
            notes: 'Second submission'
        }, authHeaders);

        if (submitRes2.data.data.version_number !== 2) throw new Error('Expected version 2');
        console.log('✅ Submission V2 successful');

        // 6. Check History
        console.log('\n📜 Checking History...');
        const historyRes = await axios.get(`${API_URL}/kpi-data/history/${componentId}`, authHeaders);
        const history = historyRes.data.data.submissions;

        if (history.length !== 2) throw new Error(`Expected 2 history items, got ${history.length}`);
        console.log('✅ History verification successful');

        // 7. Test Validation (Invalid Score)
        console.log('\n🚫 Testing Validation (Invalid Score)...');
        // First create a Score component
        const scoreCompRes = await axios.post(`${API_URL}/kpi-components`, {
            okr_id: okr.id,
            component_name: `Test Score Component ${Date.now()}`,
            component_weight: 10,
            measurement_type: 2, // Score
            target_value: 5,
            unit: 'stars'
        }, authHeaders);
        const scoreCompId = scoreCompRes.data.data.id;

        try {
            await axios.post(`${API_URL}/kpi-data`, {
                kpi_component_id: scoreCompId,
                score_value: 3.55, // Invalid (2 decimals)
                response_count: 10,
                evidence_link: 'https://example.com'
            }, authHeaders);
            throw new Error('Should have failed validation');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('✅ Validation correctly rejected invalid score (3.55)');
            } else {
                throw err;
            }
        }

        console.log('\n🎉 ALL TESTS PASSED!');

    } catch (error) {
        console.error('\n❌ TEST FAILED');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runTests();
