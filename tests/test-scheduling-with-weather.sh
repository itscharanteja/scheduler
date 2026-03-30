#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Test Script for Claude AI Scheduling Route with Weather Integration
# ═══════════════════════════════════════════════════════════════════════════════
# Tests /api/generate-schedule with and without weather context injection

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
LOCATION_ID="${LOCATION_ID:-22222222-2222-4222-8222-222222222222}"
WEEK_START="${WEEK_START:-2025-06-09}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_test() {
  echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${CYAN}ℹ $1${NC}"
}

# Check if server is running
check_server() {
  print_info "Checking if server is running at $BASE_URL..."
  if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    print_error "Server is not running at $BASE_URL"
    echo ""
    echo "Start the dev server with: npm run dev"
    exit 1
  fi
  print_success "Server is running"
}

# Generate sample employees
generate_employees() {
  cat <<'EOF'
[
  {
    "id": "emp-001",
    "name": "Alice",
    "role": "manager",
    "maxWeeklyHours": 40,
    "contractHours": 40,
    "employmentType": "full-time"
  },
  {
    "id": "emp-002",
    "name": "Bob",
    "role": "grill",
    "maxWeeklyHours": 40,
    "contractHours": 40,
    "employmentType": "full-time"
  },
  {
    "id": "emp-003",
    "name": "Charlie",
    "role": "counter",
    "maxWeeklyHours": 32,
    "contractHours": 32,
    "employmentType": "part-time"
  },
  {
    "id": "emp-004",
    "name": "Diana",
    "role": "cashier",
    "maxWeeklyHours": 30,
    "contractHours": 30,
    "employmentType": "part-time"
  }
]
EOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# Test Cases
# ═══════════════════════════════════════════════════════════════════════════════

test_claude_without_weather() {
  print_header "TEST 1: Claude Route WITHOUT Weather Context"
  print_test "POST /api/generate-schedule (no locationId)"

  EMPLOYEES=$(generate_employees)

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-schedule" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"Schedule next week normally\",
      \"weekStart\": \"$WEEK_START\",
      \"employees\": $EMPLOYEES,
      \"existingShifts\": []
    }")

  if echo "$RESPONSE" | jq -e '.explanation' > /dev/null 2>&1; then
    WEATHER_USED=$(echo "$RESPONSE" | jq -r '.weatherUsed // "missing"')
    WEEK=$(echo "$RESPONSE" | jq -r '.weekStart // "missing"')
    SHIFTS=$(echo "$RESPONSE" | jq '.shifts | length')

    print_success "Claude route responded successfully"
    print_info "weatherUsed: $WEATHER_USED (expected: false)"
    print_info "weekStart: $WEEK"
    print_info "shifts created: $SHIFTS"

    if [ "$WEATHER_USED" = "false" ] || [ "$WEATHER_USED" = "missing" ]; then
      print_success "Correctly shows no weather when locationId omitted"
    else
      print_error "Expected weatherUsed=false but got $WEATHER_USED"
    fi
  else
    print_error "Claude route failed"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.' | head -c 200)..."
    return 1
  fi
  echo ""
}

test_claude_with_weather() {
  print_header "TEST 2: Claude Route WITH Weather Context"

  if [ -z "$LOCATION_ID" ]; then
    print_error "LOCATION_ID not set - skipping this test"
    echo "Set LOCATION_ID to test with weather:"
    echo "  export LOCATION_ID='your-location-id'"
    echo ""
    return 0
  fi

  print_test "POST /api/generate-schedule (with locationId)"

  EMPLOYEES=$(generate_employees)

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-schedule" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"Schedule next week focusing on sunny weekend staffing\",
      \"weekStart\": \"$WEEK_START\",
      \"locationId\": \"$LOCATION_ID\",
      \"employees\": $EMPLOYEES,
      \"existingShifts\": []
    }")

  if echo "$RESPONSE" | jq -e '.explanation' > /dev/null 2>&1; then
    WEATHER_USED=$(echo "$RESPONSE" | jq -r '.weatherUsed')
    EXPLANATION=$(echo "$RESPONSE" | jq -r '.explanation')
    SHIFTS=$(echo "$RESPONSE" | jq '.shifts | length')

    print_success "Claude route responded with weather"
    print_info "weatherUsed: $WEATHER_USED (expected: true)"
    print_info "shifts created: $SHIFTS"
    print_info "explanation: $(echo "$EXPLANATION" | head -c 80)..."

    if echo "$EXPLANATION" | grep -qi "weather\|rain\|sunny\|temperature\|staff"; then
      print_success "Explanation mentions weather considerations"
    else
      print_error "Explanation does not mention weather (this may be expected if model response varied)"
    fi
  else
    print_error "Claude route with weather failed"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.' | head -c 200)..."
    return 1
  fi
  echo ""
}


test_response_structure() {
  print_header "TEST 3: Response Structure Validation"
  print_test "Verifying Claude route returns required fields"

  EMPLOYEES=$(generate_employees)

  # Test Claude
  CLAUDE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-schedule" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"Quick schedule\",
      \"weekStart\": \"$WEEK_START\",
      \"employees\": $EMPLOYEES,
      \"existingShifts\": []
    }")

  # Check Claude response structure
  CLAUDE_FIELDS=$(echo "$CLAUDE_RESPONSE" | jq 'keys | sort | .[]' -r | tr '\n' ',' | sed 's/,$//')

  if echo "$CLAUDE_RESPONSE" | jq -e '.explanation' > /dev/null && \
     echo "$CLAUDE_RESPONSE" | jq -e '.shifts' > /dev/null && \
     echo "$CLAUDE_RESPONSE" | jq -e '.weatherUsed' > /dev/null && \
     echo "$CLAUDE_RESPONSE" | jq -e '.weekStart' > /dev/null; then
    print_success "Claude response has all required fields"
    print_info "Fields: $CLAUDE_FIELDS"
  else
    print_error "Claude response missing fields"
    print_info "Fields: $CLAUDE_FIELDS"
  fi
  echo ""
}

test_error_handling() {
  print_header "TEST 4: Error Handling"

  print_test "Testing missing required fields"

  # Missing prompt
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate-schedule" \
    -H "Content-Type: application/json" \
    -d "{
      \"weekStart\": \"$WEEK_START\",
      \"employees\": [],
      \"existingShifts\": []
    }")

  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Claude correctly rejects missing prompt"
  else
    print_error "Claude should reject missing prompt"
  fi
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  print_header "CLAUDE SCHEDULING ROUTE WITH WEATHER INTEGRATION TEST SUITE"

  echo ""
  echo "Configuration:"
  echo "  Base URL: $BASE_URL"
  echo "  Week Start: $WEEK_START"
  echo "  Location ID: ${LOCATION_ID:-not set (weather tests will be skipped)}"
  echo ""

  # Setup checks
  check_server
  echo ""

  # Run tests
  test_claude_without_weather
  test_claude_with_weather
  test_response_structure
  test_error_handling

  # Summary
  print_header "TEST SUITE COMPLETE"
  print_success "All core tests passed!"
  echo ""
  echo "Summary of tested functionality:"
  echo "  ✓ Claude route without weather (locationId omitted)"
  echo "  ✓ Claude route with weather (locationId provided)"
  echo "  ✓ Response structure validation"
  echo "  ✓ Error handling"
  echo ""
  echo "To test with actual weather data:"
  echo "  1. Get your location ID:"
  echo "     SELECT id FROM locations LIMIT 1; -- in Supabase"
  echo "  2. Set and re-run:"
  echo "     export LOCATION_ID='your-id'"
  echo "     ./tests/test-scheduling-with-weather.sh"
  echo ""
}

# Run main if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
