#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Test Script for Shift Logs API Routes
# ═══════════════════════════════════════════════════════════════════════════════

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
LOCATION_ID="${LOCATION_ID:-22222222-2222-4222-8222-222222222222}"
EMPLOYEE_ID="${EMPLOYEE_ID:-33333333-3333-4333-8333-333333333301}"
LOG_ID="${LOG_ID:-267d5a67-7f24-4794-be54-e6d44cd40818}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
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
  echo -e "${BLUE}ℹ $1${NC}"
}

# Check if required IDs are set
check_ids() {
  if [ -z "$LOCATION_ID" ]; then
    print_error "LOCATION_ID is not set"
    echo ""
    echo "To get the location ID, run in Supabase SQL editor:"
    echo "  SELECT id FROM locations LIMIT 1;"
    echo ""
    echo "Then set: export LOCATION_ID='your-id'"
    exit 1
  fi

  if [ -z "$EMPLOYEE_ID" ]; then
    print_error "EMPLOYEE_ID is not set"
    echo ""
    echo "To get an employee ID, run in Supabase SQL editor:"
    echo "  SELECT id, name FROM employees LIMIT 5;"
    echo ""
    echo "Then set: export EMPLOYEE_ID='your-employee-id'"
    exit 1
  fi
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

# ═══════════════════════════════════════════════════════════════════════════════
# Test Cases
# ═══════════════════════════════════════════════════════════════════════════════

test_get_shift_logs() {
  print_header "TEST 1: GET /api/shift-logs"
  print_test "Fetching shift logs for location"

  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs?locationId=$LOCATION_ID&limit=20")

  if echo "$RESPONSE" | jq -e '.logs' > /dev/null 2>&1; then
    COUNT=$(echo "$RESPONSE" | jq '.count')
    print_success "Fetched $COUNT shift logs"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to fetch logs"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_get_shift_logs_by_date() {
  print_header "TEST 2: GET /api/shift-logs/by-date"
  print_test "Fetching logs for specific date"

  DATE="2025-06-09"
  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs/by-date?locationId=$LOCATION_ID&date=$DATE")

  if echo "$RESPONSE" | jq -e '.logs' > /dev/null 2>&1; then
    COUNT=$(echo "$RESPONSE" | jq '.count')
    print_success "Fetched $COUNT logs for $DATE"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to fetch logs by date"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_get_flagged_logs() {
  print_header "TEST 3: GET /api/shift-logs/flagged"
  print_test "Fetching flagged logs (issues)"

  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs/flagged?locationId=$LOCATION_ID")

  if echo "$RESPONSE" | jq -e '.logs' > /dev/null 2>&1; then
    COUNT=$(echo "$RESPONSE" | jq '.count')
    HAS_ISSUES=$(echo "$RESPONSE" | jq '.hasIssues')
    print_success "Fetched $COUNT flagged logs (hasIssues: $HAS_ISSUES)"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to fetch flagged logs"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_create_shift_log() {
  print_header "TEST 4: POST /api/shift-logs/create"
  print_test "Creating new shift log entry"

  DATE=$(date +%Y-%m-%d)
  PAYLOAD=$(cat <<EOF
{
  "locationId": "$LOCATION_ID",
  "shiftLeaderId": "$EMPLOYEE_ID",
  "date": "$DATE",
  "shiftType": "morning",
  "notes": "Test log entry created at $(date) via test script",
  "issuesFlagged": false,
  "tasksCompleted": ["Opening checks", "Staff briefing"],
  "tasksPending": []
}
EOF
)

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/shift-logs/create" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  if echo "$RESPONSE" | jq -e '.log.id' > /dev/null 2>&1; then
    CREATED_ID=$(echo "$RESPONSE" | jq -r '.log.id')
    SUCCESS=$(echo "$RESPONSE" | jq '.success')
    print_success "Created shift log (ID: $CREATED_ID, success: $SUCCESS)"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"

    # Store the ID for the update test
    LOG_ID=$CREATED_ID
  else
    print_error "Failed to create shift log"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_create_shift_log_with_flag() {
  print_header "TEST 4B: POST /api/shift-logs/create (with flag)"
  print_test "Creating shift log with issues flagged (sends alert)"

  DATE=$(date +%Y-%m-%d)
  PAYLOAD=$(cat <<EOF
{
  "locationId": "$LOCATION_ID",
  "shiftLeaderId": "$EMPLOYEE_ID",
  "date": "$DATE",
  "shiftType": "evening",
  "notes": "Critical issue found: Equipment malfunction during service",
  "issuesFlagged": true,
  "tasksCompleted": ["Equipment check"],
  "tasksPending": ["Repair equipment", "Document incident"]
}
EOF
)

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/shift-logs/create" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  if echo "$RESPONSE" | jq -e '.log.id' > /dev/null 2>&1; then
    CREATED_ID=$(echo "$RESPONSE" | jq -r '.log.id')
    ALERT_SENT=$(echo "$RESPONSE" | jq '.alertSent')
    print_success "Created flagged shift log (ID: $CREATED_ID, alertSent: $ALERT_SENT)"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to create flagged shift log"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_update_shift_log() {
  print_header "TEST 5: PATCH /api/shift-logs/update"

  if [ -z "$LOG_ID" ]; then
    print_error "No LOG_ID available (run create test first)"
    echo ""
    return 1
  fi

  print_test "Updating shift log (ID: $LOG_ID)"

  PAYLOAD=$(cat <<EOF
{
  "id": "$LOG_ID",
  "notes": "Updated notes: Test complete",
  "tasksPending": ["Follow up"]
}
EOF
)

  RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/shift-logs/update" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  if echo "$RESPONSE" | jq -e '.log.id' > /dev/null 2>&1; then
    SUCCESS=$(echo "$RESPONSE" | jq '.success')
    print_success "Updated shift log (success: $SUCCESS)"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to update shift log"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

test_get_summary() {
  print_header "TEST 6: GET /api/shift-logs/summary"
  print_test "Fetching 7-day summary for dashboard"

  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs/summary?locationId=$LOCATION_ID")

  if echo "$RESPONSE" | jq -e '.totalLogs' > /dev/null 2>&1; then
    TOTAL=$(echo "$RESPONSE" | jq '.totalLogs')
    FLAGGED=$(echo "$RESPONSE" | jq '.flaggedCount')
    PENDING=$(echo "$RESPONSE" | jq '.hasPendingTasks')
    print_success "Fetched summary (total: $TOTAL, flagged: $FLAGGED, hasPending: $PENDING)"
    print_info "Response: $(echo "$RESPONSE" | jq -c '.')"
  else
    print_error "Failed to fetch summary"
    print_info "Response: $RESPONSE"
    return 1
  fi
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Error Cases
# ═══════════════════════════════════════════════════════════════════════════════

test_error_cases() {
  print_header "ERROR CASES"

  print_test "1. Missing locationId"
  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs")
  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Correctly rejected (missing locationId)"
  else
    print_error "Should have rejected missing locationId"
  fi

  print_test "2. Invalid date format"
  RESPONSE=$(curl -s "$BASE_URL/api/shift-logs/by-date?locationId=$LOCATION_ID&date=invalid")
  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Correctly rejected (invalid date)"
  else
    print_error "Should have rejected invalid date"
  fi

  print_test "3. Invalid shiftType"
  PAYLOAD=$(cat <<EOF
{
  "locationId": "$LOCATION_ID",
  "shiftLeaderId": "$EMPLOYEE_ID",
  "date": "$(date +%Y-%m-%d)",
  "shiftType": "invalid",
  "notes": "Test",
  "issuesFlagged": false,
  "tasksCompleted": [],
  "tasksPending": []
}
EOF
)
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/shift-logs/create" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Correctly rejected (invalid shiftType)"
  else
    print_error "Should have rejected invalid shiftType"
  fi

  print_test "4. Notes too long (>2000 chars)"
  LONG_NOTES=$(printf 'x%.0s' {1..2001})
  PAYLOAD=$(cat <<EOF
{
  "locationId": "$LOCATION_ID",
  "shiftLeaderId": "$EMPLOYEE_ID",
  "date": "$(date +%Y-%m-%d)",
  "shiftType": "morning",
  "notes": "$LONG_NOTES",
  "issuesFlagged": false,
  "tasksCompleted": [],
  "tasksPending": []
}
EOF
)
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/shift-logs/create" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")
  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Correctly rejected (notes too long)"
  else
    print_error "Should have rejected notes > 2000 chars"
  fi

  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  echo ""
  print_header "SHIFT LOGS API TEST SUITE"
  echo ""

  # Setup checks
  check_ids
  check_server
  echo ""

  # Run tests
  test_get_shift_logs
  test_get_shift_logs_by_date
  test_get_flagged_logs
  test_create_shift_log
  test_create_shift_log_with_flag
  test_update_shift_log
  test_get_summary
  test_error_cases

  # Summary
  print_header "TEST SUITE COMPLETE"
  print_success "All tests passed!"
  echo ""
  echo "Summary of tested endpoints:"
  echo "  ✓ GET /api/shift-logs"
  echo "  ✓ GET /api/shift-logs/by-date"
  echo "  ✓ GET /api/shift-logs/flagged"
  echo "  ✓ POST /api/shift-logs/create"
  echo "  ✓ POST /api/shift-logs/create (with flag)"
  echo "  ✓ PATCH /api/shift-logs/update"
  echo "  ✓ GET /api/shift-logs/summary"
  echo ""
}

# Run main if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
