#!/bin/bash

# Test suite for mab-runner utility

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MAB_RUNNER="$SCRIPT_DIR/../mab-runner"

# State file path
STATE_FILE="/tmp/mab-runner-state.json"

# Function to clean state between tests
cleanup_state() {
    rm -f "$STATE_FILE"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="$3"
    local should_contain="$4"
    local should_not_contain="$5"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Run the mab-runner utility
    local output
    local exit_code

    # Parse command to separate binary and arguments
    local args="${command#$MAB_RUNNER}"
    args="${args# }"  # Remove leading space if any

    if [ -z "$args" ]; then
        # No arguments, just run the binary
        output=$("$MAB_RUNNER" 2>&1)
        exit_code=$?
    else
        # Has arguments
        output=$("$MAB_RUNNER" $args 2>&1)
        exit_code=$?
    fi

    local test_passed=true
    local failure_reasons=()

    # Check exit code
    if [ $exit_code -ne $expected_exit_code ]; then
        test_passed=false
        failure_reasons+=("Exit code: expected $expected_exit_code, got $exit_code")
    fi

    # Check if output contains expected text
    if [ -n "$should_contain" ]; then
        if ! echo "$output" | grep -q "$should_contain"; then
            test_passed=false
            failure_reasons+=("Output should contain: '$should_contain'")
        fi
    fi

    # Check if output doesn't contain unexpected text
    if [ -n "$should_not_contain" ]; then
        if echo "$output" | grep -q "$should_not_contain"; then
            test_passed=false
            failure_reasons+=("Output should not contain: '$should_not_contain'")
        fi
    fi

    if [ "$test_passed" = true ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        for reason in "${failure_reasons[@]}"; do
            echo "  - $reason"
        done
        if [ -n "$DEBUG" ]; then
            echo "  Output:"
            echo "$output" | sed 's/^/    /'
        fi
    fi
}

# Function to test with state cleanup
test_with_cleanup() {
    cleanup_state
    run_test "$1" "$2" "$3" "$4" "$5"
}

# Test 1: No command should fail
run_test "No command fails" \
    "$MAB_RUNNER" \
    1 \
    "Error: No command specified" \
    ""

# Test 2: Unknown command fails
run_test "Unknown command fails" \
    "$MAB_RUNNER invalid" \
    1 \
    "Unknown command 'invalid'" \
    ""

# Test 3: Init without agents fails
run_test "Init without agents fails" \
    "$MAB_RUNNER init" \
    1 \
    "agents required" \
    ""

# Test 4: Init with invalid agents fails
run_test "Init with invalid agents fails" \
    "$MAB_RUNNER init --agents 0" \
    1 \
    "positive integer" \
    ""

# Test 5: Init with valid agents succeeds
run_test "Init with valid agents succeeds" \
    "$MAB_RUNNER init --agents 4" \
    0 \
    '"success":true' \
    ""

# Test 6: Select without init fails
test_with_cleanup "Select without init fails" \
    "$MAB_RUNNER select" \
    2 \
    "" \
    ""

# Test 7: Update without init fails
test_with_cleanup "Update without init fails" \
    "$MAB_RUNNER update agent_0 0.8" \
    2 \
    "" \
    ""

# Test 8: Update with invalid score fails
run_test "Update with invalid score fails" \
    "$MAB_RUNNER update agent_0 invalid" \
    1 \
    "score must be a number" \
    ""

# Test 9: Status without init fails
test_with_cleanup "Status without init fails" \
    "$MAB_RUNNER status" \
    2 \
    "" \
    ""

# Test 10: Winner without init fails
test_with_cleanup "Winner without init fails" \
    "$MAB_RUNNER winner" \
    2 \
    "" \
    ""

# Test 11: Full workflow test
echo -e "\n${YELLOW}Testing full workflow...${NC}"
cleanup_state
init_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 2>/dev/null)
if [ $? -eq 0 ]; then
    TESTS_RUN=$((TESTS_RUN + 1))

    workflow_test_passed=true
    failure_reasons=()

    # Perform several updates
    for i in {1..5}; do
        agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Select failed in iteration $i")
            break
        fi

        # Extract agent number from "agent_X" format and remove quotes
        clean_agent_id=$(echo "$agent_id" | tr -d '"')
        agent_num=$(echo "$clean_agent_id" | tr -d 'agent_')

        # Generate a score (higher for lower agent numbers to simulate bias)
        score=$((100 - agent_num * 10))
        score_float=$(echo "scale=2; $score / 100" | bc)

        update_result=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_agent_id" "$score_float" 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Update failed in iteration $i")
            break
        fi
    done

    if [ "$workflow_test_passed" = true ]; then
        # Check status output
        status_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" status 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Status failed")
        elif ! echo "$status_output" | grep -q "total_evaluations"; then
            workflow_test_passed=false
            failure_reasons+=("Status missing total_evaluations")
        elif ! echo "$status_output" | grep -q "agent_stats"; then
            workflow_test_passed=false
            failure_reasons+=("Status missing agent_stats")
        fi

        # Check winner output
        winner_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" winner 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Winner failed")
        elif ! echo "$winner_output" | grep -q "winner_id"; then
            workflow_test_passed=false
            failure_reasons+=("Winner missing winner_id")
        elif ! echo "$winner_output" | grep -q "complete"; then
            workflow_test_passed=false
            failure_reasons+=("Winner missing complete")
        fi
    fi

    if [ "$workflow_test_passed" = true ]; then
        echo -e "${GREEN}✓${NC} Full workflow test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Full workflow test failed"
        for reason in "${failure_reasons[@]}"; do
            echo "  - $reason"
        done
        if [ -n "$DEBUG" ]; then
            echo "  Status output:"
            echo "$status_output" | sed 's/^/    /'
            echo "  Winner output:"
            echo "$winner_output" | sed 's/^/    /'
        fi
    fi
else
    echo -e "${RED}✗${NC} Init failed for workflow test"
    TESTS_RUN=$((TESTS_RUN + 1))
fi

# Test 12: Reset functionality
echo -e "\n${YELLOW}Testing reset functionality...${NC}"
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
reset_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" reset 2>/dev/null)
exit_code=$?

reset_test_passed=true
failure_reasons=()

if [ $exit_code -ne 0 ]; then
    reset_test_passed=false
    failure_reasons+=("Exit code: expected 0, got $exit_code")
fi

if ! echo "$reset_output" | grep -q '"success":true'; then
    reset_test_passed=false
    failure_reasons+=("Reset should return success: true")
fi

if [ "$reset_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Reset functionality works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Reset functionality failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$reset_output" | sed 's/^/    /'
    fi
fi

# Test 13: Select fails after reset
TESTS_RUN=$((TESTS_RUN + 1))
select_after_reset_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>&1)
select_after_reset_code=$?

if [ $select_after_reset_code -eq 2 ]; then
    echo -e "${GREEN}✓${NC} Select fails after reset (tournament not initialized)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Select should fail after reset"
    if [ -n "$DEBUG" ]; then
        echo "  Exit code: $select_after_reset_code (expected 2)"
        echo "  Output:"
        echo "$select_after_reset_output" | sed 's/^/    /'
    fi
fi

# Test 14: Help command works
echo -e "\n${YELLOW}Testing help commands...${NC}"
TESTS_RUN=$((TESTS_RUN + 1))
help_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" init --help 2>/dev/null)
if echo "$help_output" | grep -q "Usage:"; then
    echo -e "${GREEN}✓${NC} Help command works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Help command failed"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$help_output" | sed 's/^/    /'
    fi
fi

# Test 15: JSON structure validation
echo -e "\n${YELLOW}Testing JSON structure...${NC}"
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 4 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
json_test_passed=true
failure_reasons=()

# Test status JSON structure
status_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" status 2>/dev/null)
if [ $? -ne 0 ]; then
    json_test_passed=false
    failure_reasons+=("Status command failed")
else
    # Validate required JSON fields
    required_fields=("total_evaluations" "agent_stats" "convergence_progress" "estimated_evaluations_remaining")
    for field in "${required_fields[@]}"; do
        if ! echo "$status_output" | grep -q "\"$field\":"; then
            json_test_passed=false
            failure_reasons+=("Status missing field: $field")
        fi
    done

    # Validate agent_stats structure for Gaussian model
    if ! echo "$status_output" | grep -q "agent_id"; then
        json_test_passed=false
        failure_reasons+=("Status agent_stats missing agent_id")
    fi
    if ! echo "$status_output" | grep -q "std_dev"; then
        json_test_passed=false
        failure_reasons+=("Status agent_stats missing std_dev (Gaussian model)")
    fi
fi

if [ "$json_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} JSON structure is valid"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} JSON structure test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$status_output" | sed 's/^/    /'
    fi
fi

# Test 16: Thompson Sampling exploration and exploitation
echo -e "\n${YELLOW}Testing Thompson Sampling behavior...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
sampling_test_passed=true
failure_reasons=()

# Test exploration phase - all agents with equal scores
declare -A explore_selections
for i in {1..30}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    if [ $? -eq 0 ]; then
        clean_id=$(echo "$agent_id" | tr -d '"')
        explore_selections[$clean_id]=$((explore_selections[$clean_id] + 1))
        # Give equal scores to maintain uncertainty
        tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.5 >/dev/null 2>&1
    else
        sampling_test_passed=false
        failure_reasons+=("Select failed in exploration test")
        break
    fi
done

# Check that all agents were explored
unexplored_agents=0
for agent in agent_0 agent_1 agent_2; do
    if [ ${explore_selections[$agent]:-0} -eq 0 ]; then
        unexplored_agents=$((unexplored_agents + 1))
    fi
done

if [ $unexplored_agents -gt 0 ]; then
    sampling_test_passed=false
    failure_reasons+=("$unexplored_agents agents were never explored")
fi

# Test exploitation phase - give agent_1 higher scores
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

# Establish agent_1 as best performer
for i in {1..5}; do
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.3 >/dev/null 2>&1
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_1 0.9 >/dev/null 2>&1
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_2 0.3 >/dev/null 2>&1
done

# Now test exploitation
declare -A exploit_selections
for i in {1..20}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    clean_id=$(echo "$agent_id" | tr -d '"')
    exploit_selections[$clean_id]=$((exploit_selections[$clean_id] + 1))
    # Continue with consistent scores
    case $clean_id in
        agent_1) tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.9 >/dev/null 2>&1;;
        *) tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.3 >/dev/null 2>&1;;
    esac
done

# Agent_1 should be selected most often
agent1_count=${exploit_selections[agent_1]:-0}
if [ $agent1_count -lt 10 ]; then
    sampling_test_passed=false
    failure_reasons+=("Best agent selected only $agent1_count/20 times (poor exploitation)")
fi

if [ "$sampling_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Thompson Sampling explores and exploits properly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Thompson Sampling test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 17: Agent ID format validation
echo -e "\n${YELLOW}Testing agent ID format...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 5 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
id_test_passed=true
failure_reasons=()

# Test that select returns properly formatted agent IDs
for i in {1..10}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    if [ $? -ne 0 ]; then
        id_test_passed=false
        failure_reasons+=("Select failed in iteration $i")
        break
    fi

    # Check format is "agent_X" where X is a number
    if ! echo "$agent_id" | grep -q '"agent_[0-9]"' ; then
        id_test_passed=false
        failure_reasons+=("Invalid agent ID format: '$agent_id' (expected 'agent_X')")
        break
    fi
done

if [ "$id_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Agent ID format is correct"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Agent ID format test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 18: Invalid agent update fails
echo -e "\n${YELLOW}Testing invalid agent update...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
invalid_update_test_passed=true
failure_reasons=()

# Test updating with invalid agent ID
invalid_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update invalid_agent 0.5 2>&1)
invalid_exit_code=$?

if [ $invalid_exit_code -ne 3 ]; then
    invalid_update_test_passed=false
    failure_reasons+=("Expected exit code 3 for invalid agent, got $invalid_exit_code")
fi

if [ "$invalid_update_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Invalid agent update fails correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Invalid agent update test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 19: Edge case - Single agent tournament
echo -e "\n${YELLOW}Testing single agent tournament...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 1 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
single_agent_test_passed=true
failure_reasons=()

# Test that select always returns the single agent
for i in {1..5}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    if [ "$agent_id" != '"agent_0"' ]; then
        single_agent_test_passed=false
        failure_reasons+=("Expected agent_0, got $agent_id")
        break
    fi
done

# Test that winner shows the single agent as winner
winner_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" winner 2>/dev/null)
if ! echo "$winner_output" | grep -q '"winner_id":"agent_0"'; then
    single_agent_test_passed=false
    failure_reasons+=("Winner should be agent_0 for single agent tournament")
fi

if [ "$single_agent_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Single agent tournament works correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Single agent tournament test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 20: Score boundary tests
echo -e "\n${YELLOW}Testing score boundaries...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
boundary_test_passed=true
failure_reasons=()

# Test score 0.0 (minimum)
score_zero_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.0 2>&1)
if [ $? -ne 0 ]; then
    boundary_test_passed=false
    failure_reasons+=("Score 0.0 should be valid")
fi

# Test score 1.0 (maximum)
score_one_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_1 1.0 2>&1)
if [ $? -ne 0 ]; then
    boundary_test_passed=false
    failure_reasons+=("Score 1.0 should be valid")
fi

# Test score < 0 (should fail)
score_negative_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_2 -0.1 2>&1)
if [ $? -eq 0 ]; then
    boundary_test_passed=false
    failure_reasons+=("Score < 0 should be invalid")
fi

# Test score > 1 (should fail)
score_over_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 1.1 2>&1)
if [ $? -eq 0 ]; then
    boundary_test_passed=false
    failure_reasons+=("Score > 1 should be invalid")
fi

if [ "$boundary_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Score boundaries work correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Score boundaries test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 21: RNG produces valid values [0,1)
echo -e "\n${YELLOW}Testing RNG produces valid values...${NC}"
cleanup_state

TESTS_RUN=$((TESTS_RUN + 1))
rng_test_passed=true
failure_reasons=()

# Initialize with seed 42 (known to produce negative values with bug)
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 42 >/dev/null 2>&1

# Test that initial selections work and explore all agents
declare -A rng_selections
for i in {1..30}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    if [ $? -ne 0 ]; then
        rng_test_passed=false
        failure_reasons+=("Select failed on iteration $i")
        break
    fi
    clean_id=$(echo "$agent_id" | tr -d '"')
    rng_selections[$clean_id]=$((rng_selections[$clean_id] + 1))

    # Give random scores to maintain uncertainty
    tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.5 >/dev/null 2>&1
done

# Check that all agents were selected at least once (proper exploration)
agents_selected=0
for agent in agent_0 agent_1 agent_2; do
    if [ ${rng_selections[$agent]:-0} -gt 0 ]; then
        agents_selected=$((agents_selected + 1))
    fi
done

if [ $agents_selected -lt 3 ]; then
    rng_test_passed=false
    failure_reasons+=("Only $agents_selected out of 3 agents were explored (seed=42)")
    failure_reasons+=("agent_0: ${rng_selections[agent_0]:-0} times")
    failure_reasons+=("agent_1: ${rng_selections[agent_1]:-0} times")
    failure_reasons+=("agent_2: ${rng_selections[agent_2]:-0} times")
fi

if [ "$rng_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} RNG produces valid values and proper exploration"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} RNG test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 22: Reproducibility with seeds
echo -e "\n${YELLOW}Testing reproducibility with seeds...${NC}"
cleanup_state

TESTS_RUN=$((TESTS_RUN + 1))
reproducibility_test_passed=true
failure_reasons=()

# Run tournament with seed 123
selections_1=()
for i in {1..10}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 123 >/dev/null 2>&1 && tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    clean_id=$(echo "$agent_id" | tr -d '"')
    selections_1+=("$clean_id")
    cleanup_state
done

# Run tournament with same seed 123 again
selections_2=()
for i in {1..10}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 123 >/dev/null 2>&1 && tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    clean_id=$(echo "$agent_id" | tr -d '"')
    selections_2+=("$clean_id")
    cleanup_state
done

# Compare selections
for i in {0..9}; do
    if [ "${selections_1[$i]}" != "${selections_2[$i]}" ]; then
        reproducibility_test_passed=false
        failure_reasons+=("Selection $i differs: ${selections_1[$i]} vs ${selections_2[$i]}")
        break
    fi
done

if [ "$reproducibility_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Reproducibility with seeds works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Reproducibility test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 22: Algorithm convergence with clear winner
echo -e "\n${YELLOW}Testing algorithm convergence...${NC}"
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
convergence_test_passed=true
failure_reasons=()

# Give each agent distinct win rates
for i in {1..10}; do
    # agent_0: 90% win rate
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.9 >/dev/null 2>&1
    # agent_1: 50% win rate
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_1 0.5 >/dev/null 2>&1
    # agent_2: 20% win rate
    tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_2 0.2 >/dev/null 2>&1
done

# Now let the algorithm converge
declare -A final_selections
for i in {1..30}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    clean_id=$(echo "$agent_id" | tr -d '"')
    final_selections[$clean_id]=$((final_selections[$clean_id] + 1))

    # Continue with consistent scores
    case $clean_id in
        agent_0) tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.9 >/dev/null 2>&1;;
        agent_1) tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.5 >/dev/null 2>&1;;
        agent_2) tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.2 >/dev/null 2>&1;;
    esac
done

# Check that agent_0 (best) is selected most often
agent0_count=${final_selections[agent_0]:-0}
agent1_count=${final_selections[agent_1]:-0}
agent2_count=${final_selections[agent_2]:-0}

if [ $agent0_count -lt $agent1_count ] || [ $agent0_count -lt $agent2_count ]; then
    convergence_test_passed=false
    failure_reasons+=("Best agent (agent_0) not selected most: a0=$agent0_count, a1=$agent1_count, a2=$agent2_count")
fi

# Check winner output
winner_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" winner 2>/dev/null)
current_winner=$(echo "$winner_output" | grep -o '"winner_id":"[^"]*"' | cut -d'"' -f4)

# Winner should be agent_0
if [ "$current_winner" != "agent_0" ]; then
    convergence_test_passed=false
    failure_reasons+=("Expected winner agent_0, got $current_winner")
fi

if [ "$convergence_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Algorithm converges to best agent"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Algorithm convergence test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 23: State persistence and recovery
echo -e "\n${YELLOW}Testing state persistence...${NC}"

TESTS_RUN=$((TESTS_RUN + 1))
persistence_test_passed=true
failure_reasons=()

# Create initial state with seed
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 789 >/dev/null 2>&1

# Perform some evaluations
for i in {1..3}; do
    agent_id=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
    clean_id=$(echo "$agent_id" | tr -d '"')
    update_result=$(tsx "$SCRIPT_DIR/../mab-runner.ts" update "$clean_id" 0.7 2>/dev/null)
    if [ $? -ne 0 ]; then
        persistence_test_passed=false
        failure_reasons+=("Failed to update in iteration $i")
        break
    fi
done

# Get status before "restart"
status_before=$(tsx "$SCRIPT_DIR/../mab-runner.ts" status 2>/dev/null)

# Check that state file exists and has content
if [ ! -s "/tmp/mab-runner-state.json" ]; then
    persistence_test_passed=false
    failure_reasons+=("State file not created or empty")
fi

# Simulate restart by cleaning state and reloading
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 789 >/dev/null 2>&1

# Verify state was restored (seeded random should work the same)
agent_after_restart=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null)
if [ -z "$agent_after_restart" ]; then
    persistence_test_passed=false
    failure_reasons+=("State not properly restored after restart")
fi

# Check that tournament is working after restart
status_after=$(tsx "$SCRIPT_DIR/../mab-runner.ts" status 2>/dev/null)
if [ -z "$status_after" ]; then
    persistence_test_passed=false
    failure_reasons+=("Status command failed after restart")
fi

if [ "$persistence_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} State persistence works correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} State persistence test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 25: Gaussian distribution updates correctly
echo -e "\n${YELLOW}Testing Gaussian distribution updates...${NC}"

TESTS_RUN=$((TESTS_RUN + 1))
gaussian_test_passed=true
failure_reasons=()

cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 2 >/dev/null 2>&1

# Update agent_0 with known scores
tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.8 >/dev/null 2>&1
tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.2 >/dev/null 2>&1
tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.7 >/dev/null 2>&1
tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.6 >/dev/null 2>&1
tsx "$SCRIPT_DIR/../mab-runner.ts" update agent_0 0.3 >/dev/null 2>&1

# Check status
status_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" status 2>/dev/null)
agent0_evals=$(echo "$status_output" | grep -A3 '"agent_0"' | grep '"evaluations"' | grep -o '[0-9]*')

if [ "$agent0_evals" -ne 5 ]; then
    gaussian_test_passed=false
    failure_reasons+=("Expected 5 evaluations, got $agent0_evals")
fi

# Mean score should be (0.8+0.2+0.7+0.6+0.3)/5 = 2.6/5 = 0.52
agent0_mean=$(echo "$status_output" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for agent in data['agent_stats']:
    if agent['agent_id'] == 'agent_0':
        print(agent['mean_score'])
")

# Check mean score is correct (allowing for floating point precision)
if [ "$(echo "$agent0_mean > 0.51 && $agent0_mean < 0.53" | bc)" -ne 1 ]; then
    gaussian_test_passed=false
    failure_reasons+=("Expected mean score ~0.52, got $agent0_mean")
fi

# Check that std_dev field exists
if ! echo "$status_output" | grep -q '"std_dev"'; then
    gaussian_test_passed=false
    failure_reasons+=("Status missing std_dev field for Gaussian model")
fi

if [ "$gaussian_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Gaussian distribution updates correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Gaussian distribution test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Test 26: Multiple tournament instances
echo -e "\n${YELLOW}Testing multiple tournament instances...${NC}"

TESTS_RUN=$((TESTS_RUN + 1))
multiple_tournament_test_passed=true
failure_reasons=()

# Test that we can run multiple tournaments sequentially without interference
cleanup_state

# First tournament - 3 agents
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 3 --seed 111 >/dev/null 2>&1
first_agent=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null | tr -d '"')
tsx "$SCRIPT_DIR/../mab-runner.ts" update "$first_agent" 0.8 >/dev/null 2>&1

# Second tournament - 2 agents (different setup)
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 2 --seed 222 >/dev/null 2>&1
second_agent=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null | tr -d '"')
tsx "$SCRIPT_DIR/../mab-runner.ts" update "$second_agent" 0.6 >/dev/null 2>&1

# Verify that both tournaments work independently
if [ "$first_agent" = "" ] || [ "$second_agent" = "" ]; then
    multiple_tournament_test_passed=false
    failure_reasons+=("Failed to get agents from tournaments")
fi

# Verify we can reset and start a new tournament
cleanup_state
tsx "$SCRIPT_DIR/../mab-runner.ts" init --agents 4 --seed 333 >/dev/null 2>&1
third_agent=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>/dev/null | tr -d '"')

if [ "$third_agent" = "" ]; then
    multiple_tournament_test_passed=false
    failure_reasons+=("Failed to start third tournament")
fi

# Verify reset works
tsx "$SCRIPT_DIR/../mab-runner.ts" reset >/dev/null 2>&1
reset_output=$(tsx "$SCRIPT_DIR/../mab-runner.ts" select 2>&1)

if [ $? -eq 0 ]; then
    multiple_tournament_test_passed=false
    failure_reasons+=("Reset should prevent further operations")
fi

if [ "$multiple_tournament_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Multiple tournament instances work"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Multiple tournament instances test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Summary
echo
echo "======================================"
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    echo "Run with DEBUG=1 to see detailed output"
    exit 1
fi

# Test 2: Unknown command fails
run_test "Unknown command fails" \
    "$MAB_RUNNER invalid" \
    1 \
    "Unknown command 'invalid'" \
    ""

# Test 3: Init without agents fails
run_test "Init without agents fails" \
    "$MAB_RUNNER init" \
    1 \
    "agents required" \
    ""

# Test 4: Init with invalid agents fails
run_test "Init with invalid agents fails" \
    "$MAB_RUNNER init --agents 0" \
    1 \
    "positive integer" \
    ""

# Test 5: Init with valid agents succeeds
run_test "Init with valid agents succeeds" \
    "$MAB_RUNNER init --agents 4" \
    0 \
    '"success":true' \
    ""

# Test 6: Select without init fails
run_test "Select without init fails" \
    "$MAB_RUNNER select" \
    2 \
    "" \
    ""

# Test 7: Initialize tournament and test select
output=$($MAB_RUNNER init --agents 3 2>/dev/null)
if [ $? -eq 0 ]; then
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test select returns valid agent ID
    select_output=$($MAB_RUNNER select 2>/dev/null)
    exit_code=$?

    select_test_passed=true
    failure_reasons=()

    if [ $exit_code -ne 0 ]; then
        select_test_passed=false
        failure_reasons+=("Exit code: expected 0, got $exit_code")
    fi

    # Check if output is a valid agent ID (agent_X format)
    if ! echo "$select_output" | grep -q '"agent_[0-9]"' ; then
        select_test_passed=false
        failure_reasons+=("Output should be agent ID in quotes: '$select_output'")
    fi

    if [ "$select_test_passed" = true ]; then
        echo -e "${GREEN}✓${NC} Select returns valid agent ID"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Select returns valid agent ID"
        for reason in "${failure_reasons[@]}"; do
            echo "  - $reason"
        done
        if [ -n "$DEBUG" ]; then
            echo "  Output:"
            echo "$select_output" | sed 's/^/    /'
        fi
    fi
else
    echo -e "${RED}✗${NC} Init failed for select test"
    TESTS_RUN=$((TESTS_RUN + 1))
fi

# Test 8: Test update without init fails
run_test "Update without init fails" \
    "$MAB_RUNNER update agent_0 0.8" \
    2 \
    "" \
    ""

# Test 9: Test update with invalid score fails
run_test "Update with invalid score fails" \
    'echo "not_json" | '"$MAB_RUNNER"' update agent_0 invalid' \
    1 \
    "score must be a number" \
    ""

# Test 10: Test status without init fails
run_test "Status without init fails" \
    "$MAB_RUNNER status" \
    2 \
    "" \
    ""

# Test 11: Test winner without init fails
run_test "Winner without init fails" \
    "$MAB_RUNNER winner" \
    2 \
    "" \
    ""

# Test 12: Initialize and test full workflow
echo -e "\n${YELLOW}Testing full workflow...${NC}"

# Initialize tournament
init_output=$($MAB_RUNNER init --agents 5 2>/dev/null)
if [ $? -eq 0 ]; then
    TESTS_RUN=$((TESTS_RUN + 1))

    workflow_test_passed=true
    failure_reasons=()

    # Perform several updates
    for i in {1..10}; do
        agent_id=$($MAB_RUNNER select 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Select failed in iteration $i")
            break
        fi

        # Extract agent number from "agent_X" format
        agent_num=$(echo "$agent_id" | tr -d '"agent_')

        # Generate a score (higher for lower agent numbers to simulate bias)
        score=$((100 - agent_num * 10))
        score_float=$(echo "scale=2; $score / 100" | bc)

        update_result=$($MAB_RUNNER update "$agent_id" "$score_float" 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Update failed in iteration $i")
            break
        fi
    done

    if [ "$workflow_test_passed" = true ]; then
        # Check status output
        status_output=$($MAB_RUNNER status 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Status failed")
        elif ! echo "$status_output" | grep -q "total_evaluations"; then
            workflow_test_passed=false
            failure_reasons+=("Status missing total_evaluations")
        elif ! echo "$status_output" | grep -q "agent_stats"; then
            workflow_test_passed=false
            failure_reasons+=("Status missing agent_stats")
        fi

        # Check winner output
        winner_output=$($MAB_RUNNER winner 2>/dev/null)
        if [ $? -ne 0 ]; then
            workflow_test_passed=false
            failure_reasons+=("Winner failed")
        elif ! echo "$winner_output" | grep -q "winner_id"; then
            workflow_test_passed=false
            failure_reasons+=("Winner missing winner_id")
        elif ! echo "$winner_output" | grep -q "complete"; then
            workflow_test_passed=false
            failure_reasons+=("Winner missing complete")
        fi
    fi

    if [ "$workflow_test_passed" = true ]; then
        echo -e "${GREEN}✓${NC} Full workflow test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Full workflow test failed"
        for reason in "${failure_reasons[@]}"; do
            echo "  - $reason"
        done
        if [ -n "$DEBUG" ]; then
            echo "  Status output:"
            echo "$status_output" | sed 's/^/    /'
            echo "  Winner output:"
            echo "$winner_output" | sed 's/^/    /'
        fi
    fi
else
    echo -e "${RED}✗${NC} Init failed for workflow test"
    TESTS_RUN=$((TESTS_RUN + 1))
fi

# Test 13: Test reset functionality
echo -e "\n${YELLOW}Testing reset functionality...${NC}"

# Initialize tournament
$MAB_RUNNER init --agents 3 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
reset_output=$($MAB_RUNNER reset 2>/dev/null)
exit_code=$?

reset_test_passed=true
failure_reasons=()

if [ $exit_code -ne 0 ]; then
    reset_test_passed=false
    failure_reasons+=("Exit code: expected 0, got $exit_code")
fi

if ! echo "$reset_output" | grep -q '"success":true'; then
    reset_test_passed=false
    failure_reasons+=("Reset should return success: true")
fi

if [ "$reset_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Reset functionality works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Reset functionality failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$reset_output" | sed 's/^/    /'
    fi
fi

# Test 14: Test reset followed by select should fail
TESTS_RUN=$((TESTS_RUN + 1))
select_after_reset_output=$($MAB_RUNNER select 2>&1)
select_after_reset_code=$?

if [ $select_after_reset_code -eq 2 ]; then
    echo -e "${GREEN}✓${NC} Select fails after reset (tournament not initialized)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Select should fail after reset"
    if [ -n "$DEBUG" ]; then
        echo "  Exit code: $select_after_reset_code (expected 2)"
        echo "  Output:"
        echo "$select_after_reset_output" | sed 's/^/    /'
    fi
fi

# Test 15: Test help commands
echo -e "\n${YELLOW}Testing help commands...${NC}"

TESTS_RUN=$((TESTS_RUN + 1))
help_output=$($MAB_RUNNER init --help 2>/dev/null)
if echo "$help_output" | grep -q "Usage:"; then
    echo -e "${GREEN}✓${NC} Help command works"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Help command failed"
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$help_output" | sed 's/^/    /'
    fi
fi

# Test 16: Test JSON structure validation
echo -e "\n${YELLOW}Testing JSON structure...${NC}"

# Initialize tournament
$MAB_RUNNER init --agents 4 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
json_test_passed=true
failure_reasons=()

# Test status JSON structure
status_output=$($MAB_RUNNER status 2>/dev/null)
if [ $? -ne 0 ]; then
    json_test_passed=false
    failure_reasons+=("Status command failed")
else
    # Validate required JSON fields
    required_fields=("total_evaluations" "agent_stats" "convergence_progress" "estimated_evaluations_remaining")
    for field in "${required_fields[@]}"; do
        if ! echo "$status_output" | grep -q "\"$field\":"; then
            json_test_passed=false
            failure_reasons+=("Status missing field: $field")
        fi
    done

    # Validate agent_stats structure for Gaussian model
    if ! echo "$status_output" | grep -q "agent_id"; then
        json_test_passed=false
        failure_reasons+=("Status agent_stats missing agent_id")
    fi
    if ! echo "$status_output" | grep -q "std_dev"; then
        json_test_passed=false
        failure_reasons+=("Status agent_stats missing std_dev (Gaussian model)")
    fi
fi

if [ "$json_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} JSON structure is valid"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} JSON structure test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Output:"
        echo "$status_output" | sed 's/^/    /'
    fi
fi

# Test 17: Test Thompson Sampling behavior
echo -e "\n${YELLOW}Testing Thompson Sampling behavior...${NC}"

# Initialize with seed for reproducible results
$MAB_RUNNER init --agents 3 --seed 42 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
sampling_test_passed=true
failure_reasons=()

# Perform many selections to test if algorithm explores properly
selections=()
for i in {1..50}; do
    agent_id=$($MAB_RUNNER select 2>/dev/null)
    if [ $? -eq 0 ]; then
        # Extract agent number from "agent_X"
        agent_num=$(echo "$agent_id" | tr -d '"agent_')
        selections[$agent_num]=$((selections[$agent_num] + 1))
    else
        sampling_test_passed=false
        failure_reasons+=("Select failed in sampling test")
        break
    fi
done

if [ "$sampling_test_passed" = true ]; then
    # Check that all agents were selected at least once (exploration)
    all_selected=true
    for i in 0 1 2; do
        if [ ${selections[$i]:-0} -eq 0 ]; then
            all_selected=false
            failure_reasons+=("Agent $i was never selected (no exploration)")
        fi
    done

    # Check that selections are somewhat balanced (not always selecting same agent)
    max_selections=${selections[0]:-0}
    for count in "${selections[@]}"; do
        if [ ${count:-0} -gt $max_selections ]; then
            max_selections=${count:-0}
        fi
    done

    # Allow some imbalance but not extreme (shouldn't always pick same agent)
    total_selections=0
    for count in "${selections[@]}"; do
        total_selections=$((total_selections + ${count:-0}))
    done

    if [ $max_selections -gt $((total_selections * 80 / 100)) ]; then
        sampling_test_passed=false
        failure_reasons+=("Algorithm too greedy - one agent selected $max_selections out of $total_selections times")
    fi
fi

if [ "$sampling_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Thompson Sampling explores properly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Thompson Sampling test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
    if [ -n "$DEBUG" ]; then
        echo "  Selection counts: ${selections[*]}"
    fi
fi

# Test 18: Test winner convergence
echo -e "\n${YELLOW}Testing winner convergence...${NC}"

# Initialize fresh tournament
$MAB_RUNNER reset >/dev/null 2>&1
$MAB_RUNNER init --agents 4 --seed 123 >/dev/null 2>&1

TESTS_RUN=$((TESTS_RUN + 1))
convergence_test_passed=true
failure_reasons=()

# Simulate biased evaluation where agent_1 is best
for i in {1..100}; do
    agent_id=$($MAB_RUNNER select 2>/dev/null)
    agent_num=$(echo "$agent_id" | tr -d '"agent_')

    # Give higher scores to lower-numbered agents (agent_0 best, agent_3 worst)
    score=$((80 - agent_num * 15))
    score_float=$(echo "scale=2; $score / 100" | bc)

    $MAB_RUNNER update "$agent_id" "$score_float" >/dev/null 2>&1

    # Check winner every 20 evaluations
    if [ $((i % 20)) -eq 0 ]; then
        winner_output=$($MAB_RUNNER winner 2>/dev/null)
        current_winner=$(echo "$winner_output" | grep -o '"winner_id":"[^"]*"' | cut -d'"' -f4)

        # Should eventually converge to agent_0 (best)
        if [ $i -gt 60 ] && [ "$current_winner" != "agent_0" ]; then
            convergence_test_passed=false
            failure_reasons+=("After $i evaluations, winner is $current_winner (expected agent_0)")
        fi
    fi
done

if [ "$convergence_test_passed" = true ]; then
    echo -e "${GREEN}✓${NC} Winner convergence works correctly"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Winner convergence test failed"
    for reason in "${failure_reasons[@]}"; do
        echo "  - $reason"
    done
fi

# Summary
echo
echo "======================================"
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ "$TESTS_PASSED" -eq "$TESTS_RUN" ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    echo "Run with DEBUG=1 to see detailed output"
    exit 1
fi
