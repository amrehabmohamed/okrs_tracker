#!/bin/bash

# Phase 4 Integration Tests
# Tests all 4 form types with real JWT token

API_URL="http://localhost:3000/api"

# Component IDs from seed
COUNT_COMPONENT="2fcd6119-9d94-4f6f-8b3c-24f38d095591"
PERCENTAGE_COMPONENT="573c85f3-4a9a-45cd-8b0c-95abc6ca6273"
SCORE_COMPONENT="ab1e2c2b-e909-496f-877e-cafece12d9ac"
BOOLEAN_COMPONENT="970d0359-2430-4878-b538-6fc4dbc79d6b"

# Get JWT token
echo "📝 Login to get JWT..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:54321/auth/v1/token?grant_type=password \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Check credentials."
  exit 1
fi

echo "✅ Token obtained"
echo ""

# Test 1: Count form
echo "1️⃣ Testing COUNT form..."
curl -s -X POST $API_URL/kpi-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kpi_component_id\": \"$COUNT_COMPONENT\",
    \"count_value\": 3,
    \"evidence_link\": \"https://docs.google.com/document/d/test123\",
    \"notes\": \"Completed 3 customer interviews\"
  }" | jq .
echo ""

# Test 2: Percentage form
echo "2️⃣ Testing PERCENTAGE form..."
curl -s -X POST $API_URL/kpi-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kpi_component_id\": \"$PERCENTAGE_COMPONENT\",
    \"numerator\": 8,
    \"denominator\": 10,
    \"evidence_link\": \"https://docs.google.com/spreadsheets/d/test456\",
    \"notes\": \"8 out of 10 PRDs complete\"
  }" | jq .
echo ""

# Test 3: Score form
echo "3️⃣ Testing SCORE form..."
curl -s -X POST $API_URL/kpi-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kpi_component_id\": \"$SCORE_COMPONENT\",
    \"score_value\": 4.2,
    \"response_count\": 15,
    \"evidence_link\": \"https://jotform.com/report/test789\",
    \"notes\": \"Lunch & Learn feedback\"
  }" | jq .
echo ""

# Test 4: Boolean form
echo "4️⃣ Testing BOOLEAN form..."
curl -s -X POST $API_URL/kpi-data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kpi_component_id\": \"$BOOLEAN_COMPONENT\",
    \"completed\": 1,
    \"evidence_link\": \"https://docs.google.com/document/d/signoff123\",
    \"notes\": \"All stakeholders signed off\"
  }" | jq .
echo ""

# Test 5: Get user submissions
echo "5️⃣ Getting user submissions..."
curl -s -X GET "$API_URL/users/me/kpi-data" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 6: Get submission history
echo "6️⃣ Getting submission history..."
curl -s -X GET "$API_URL/users/me/submissions-history" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "✅ All tests complete!"
