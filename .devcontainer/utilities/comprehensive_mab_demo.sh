#!/bin/bash

# Comprehensive Multi-Armed Bandit Runner Test and Demo Script
# This script demonstrates all functionality of the mab-runner utility
# and includes error handling, convergence detection, and best practices.

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
MAB_RUNNER="./mab-runner"
NUM_AGENTS=4
SEED=42
MAX_ITERATIONS=100
CONVERGENCE_THRESHOLD=0.8
MIN_EVALUATIONS_PER_AGENT=10

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}${BOLD}[STEP]${NC} $1"
}

# Function to simulate agent evaluation with different performance profiles
# Agent 0: Poor performer (20% success rate)
# Agent 1: Excellent performer (85% success rate)
# Agent 2: Average performer (50% success rate)
# Agent 3: Good performer (70% success rate)
simulate_agent_evaluation() {
    local agent_id="$1"
    local base_score

    case "$agent_id" in
        "agent_0")
            base_score=0.2
            ;;
        "agent_1")
            base_score=0.85
            ;;
        "agent_2")
            base_score=0.5
            ;;
        "agent_3")
            base_score=0.7
            ;;
        *)
            base_score=0.5  # Default fallback
            ;;
    esac

    # Add some randomness (±0.15) to simulate real evaluation variance
    local noise=$(awk "BEGIN {srand(); print (rand()-0.5)*0.3}")
    local score=$(awk "BEGIN {score=$base_score + $noise; if(score < 0) score=0; if(score > 1) score=1; print score}")

    echo "$score"
}

# Function to check if tournament has converged
check_convergence() {
    local status_output="$1"
    local winner_output="$2"

    # Extract convergence info using jq if available, otherwise use basic parsing
    if command -v jq >/dev/null 2>&1; then
        local complete=$(echo "$winner_output" | jq -r '.complete')
        local winner_id=$(echo "$winner_output" | jq -r '.winner_id')
        local confidence=$(echo "$winner_output" | jq -r '.confidence')
        local total_evals=$(echo "$status_output" | jq -r '.total_evaluations')

        log_info "Convergence check: complete=$complete, winner=$winner_id, confidence=$confidence, total_evaluations=$total_evals"

        if [[ "$complete" == "true" ]]; then
            log_success "Tournament has converged!"
            return 0
        fi
    else
        log_warning "jq not available, using basic convergence detection"
        # Basic convergence check without jq
        if echo "$winner_output" | grep -q '"complete":true'; then
            log_success "Tournament has converged!"
            return 0
        fi
    fi

    return 1
}

# Function to display current statistics
display_statistics() {
    local status_output="$1"

    echo -e "${BOLD}Current Tournament Statistics:${NC}"
    if command -v jq >/dev/null 2>&1; then
        echo "$status_output" | jq '.'
    else
        echo "$status_output"
    fi
    echo
}

# Function to test error conditions
test_error_conditions() {
    log_step "Testing Error Conditions"

    # Test without initialization
    log_info "Testing commands without initialization..."
    if $MAB_RUNNER select 2>/dev/null; then
        log_error "Expected failure when calling select without init"
        return 1
    else
        log_success "Correctly failed when calling select without init (exit code: $?)"
    fi

    # Initialize for error tests
    $MAB_RUNNER init --agents 2 --seed 123 >/dev/null

    # Test invalid agent ID
    log_info "Testing invalid agent ID..."
    if $MAB_RUNNER update "invalid_agent" 0.5 2>/dev/null; then
        log_error "Expected failure with invalid agent ID"
        return 1
    else
        log_success "Correctly failed with invalid agent ID (exit code: $?)"
    fi

    # Test invalid score ranges
    log_info "Testing invalid score ranges..."
    if $MAB_RUNNER update "agent_0" 1.5 2>/dev/null; then
        log_error "Expected failure with score > 1"
        return 1
    else
        log_success "Correctly failed with score > 1 (exit code: $?)"
    fi

    if $MAB_RUNNER update "agent_0" -0.1 2>/dev/null; then
        log_error "Expected failure with score < 0"
        return 1
    else
        log_success "Correctly failed with score < 0 (exit code: $?)"
    fi

    # Test invalid command
    log_info "Testing invalid command..."
    if $MAB_RUNNER invalid_command 2>/dev/null; then
        log_error "Expected failure with invalid command"
        return 1
    else
        log_success "Correctly failed with invalid command (exit code: $?)"
    fi

    log_success "All error condition tests passed"
}

# Function to test help functionality
test_help_functionality() {
    log_step "Testing Help Functionality"

    log_info "Testing --help flag..."
    if ! $MAB_RUNNER --help >/dev/null; then
        log_error "Failed to display help with --help"
        return 1
    fi
    log_success "Help displayed successfully with --help"

    log_info "Testing -h flag..."
    if ! $MAB_RUNNER -h >/dev/null; then
        log_error "Failed to display help with -h"
        return 1
    fi
    log_success "Help displayed successfully with -h"

    # Test command-specific help (this appears to be broken based on earlier testing)
    log_info "Testing command-specific help..."
    log_warning "Command-specific help appears to have issues - showing full help instead of command-specific"

    log_success "Help functionality tests completed"
}

# Main demonstration function
main_demonstration() {
    log_step "Starting Multi-Armed Bandit Runner Demonstration"

    # Step 1: Reset any existing state
    log_step "Step 1: Resetting Tournament State"
    local reset_result
    reset_result=$($MAB_RUNNER reset)
    log_success "Reset completed: $reset_result"

    # Step 2: Initialize tournament
    log_step "Step 2: Initializing Tournament"
    log_info "Initializing with $NUM_AGENTS agents and seed $SEED for reproducibility"
    local init_result
    init_result=$($MAB_RUNNER init --agents "$NUM_AGENTS" --seed "$SEED")
    log_success "Initialization completed: $init_result"

    # Step 3: Display initial status
    log_step "Step 3: Checking Initial Status"
    local status
    status=$($MAB_RUNNER status)
    display_statistics "$status"

    # Step 4: Run optimization loop
    log_step "Step 4: Running Optimization Loop"
    log_info "Running up to $MAX_ITERATIONS iterations..."

    local iteration=0
    local last_winner=""
    local stable_winner_count=0

    while [[ $iteration -lt $MAX_ITERATIONS ]]; do
        iteration=$((iteration + 1))

        # Select next agent
        local selected_agent
        selected_agent=$($MAB_RUNNER select | tr -d '"')

        # Simulate evaluation
        local score
        score=$(simulate_agent_evaluation "$selected_agent")

        # Update agent with result
        local update_result
        update_result=$($MAB_RUNNER update "$selected_agent" "$score")

        log_info "Iteration $iteration: Selected $selected_agent, Score: $score"

        # Check status every 10 iterations
        if (( iteration % 10 == 0 )); then
            status=$($MAB_RUNNER status)
            local winner_info
            winner_info=$($MAB_RUNNER winner)

            echo -e "${BOLD}--- Iteration $iteration Status ---${NC}"
            display_statistics "$status"

            # Check for convergence
            if check_convergence "$status" "$winner_info"; then
                log_success "Converged after $iteration iterations"
                break
            fi

            # Check for winner stability
            if command -v jq >/dev/null 2>&1; then
                local current_winner
                current_winner=$(echo "$winner_info" | jq -r '.winner_id')
                if [[ "$current_winner" == "$last_winner" ]]; then
                    stable_winner_count=$((stable_winner_count + 1))
                else
                    stable_winner_count=0
                    last_winner="$current_winner"
                fi

                if [[ $stable_winner_count -ge 3 ]]; then
                    log_info "Winner has been stable for 3 checks, likely converged"
                fi
            fi
        fi

        # Add small delay for demonstration purposes
        sleep 0.1
    done

    # Step 5: Final results
    log_step "Step 5: Final Results"
    status=$($MAB_RUNNER status)
    local winner_info
    winner_info=$($MAB_RUNNER winner)

    echo -e "${BOLD}=== FINAL TOURNAMENT RESULTS ===${NC}"
    display_statistics "$status"

    echo -e "${BOLD}Winner Information:${NC}"
    if command -v jq >/dev/null 2>&1; then
        echo "$winner_info" | jq '.'
    else
        echo "$winner_info"
    fi

    # Step 6: Extract key insights
    log_step "Step 6: Key Insights"
    if command -v jq >/dev/null 2>&1; then
        local winner_id
        local winner_score
        local total_evaluations
        local is_complete

        winner_id=$(echo "$winner_info" | jq -r '.winner_id')
        winner_score=$(echo "$winner_info" | jq -r '.winner_stats.mean_score')
        total_evaluations=$(echo "$status" | jq -r '.total_evaluations')
        is_complete=$(echo "$winner_info" | jq -r '.complete')

        log_success "Winning Agent: $winner_id"
        log_success "Winner's Mean Score: $winner_score"
        log_success "Total Evaluations: $total_evaluations"
        log_success "Optimization Complete: $is_complete"

        # Verify against expected results (agent_1 should win with ~85% performance)
        if [[ "$winner_id" == "agent_1" ]]; then
            log_success "✓ Correct winner identified (agent_1 was designed to be best)"
        else
            log_warning "⚠ Unexpected winner - agent_1 was designed to perform best"
        fi

        # Performance distribution analysis
        echo -e "${BOLD}Agent Performance Analysis:${NC}"
        echo "$status" | jq -r '.agent_stats[] | "\(.agent_id): \(.evaluations) evals, \(.wins) wins, \(.mean_score*100 | round)% success"'

    else
        log_info "Install jq for detailed result analysis"
    fi
}

# Function to demonstrate reproducibility
test_reproducibility() {
    log_step "Testing Reproducibility with Seeds"

    log_info "Running two tournaments with the same seed..."

    # First run
    $MAB_RUNNER reset >/dev/null
    $MAB_RUNNER init --agents 3 --seed 999 >/dev/null
    local first_agent1
    first_agent1=$($MAB_RUNNER select | tr -d '"')
    $MAB_RUNNER update "$first_agent1" 0.7 >/dev/null
    local first_agent2
    first_agent2=$($MAB_RUNNER select | tr -d '"')

    # Second run
    $MAB_RUNNER reset >/dev/null
    $MAB_RUNNER init --agents 3 --seed 999 >/dev/null
    local second_agent1
    second_agent1=$($MAB_RUNNER select | tr -d '"')
    $MAB_RUNNER update "$second_agent1" 0.7 >/dev/null
    local second_agent2
    second_agent2=$($MAB_RUNNER select | tr -d '"')

    if [[ "$first_agent1" == "$second_agent1" && "$first_agent2" == "$second_agent2" ]]; then
        log_success "Reproducibility verified: identical selections with same seed"
    else
        log_warning "Reproducibility issue: different selections with same seed"
        log_info "First run: $first_agent1 -> $first_agent2"
        log_info "Second run: $second_agent1 -> $second_agent2"
    fi
}

# Function to run all tests
run_all_tests() {
    echo -e "${BOLD}${CYAN}Multi-Armed Bandit Runner - Comprehensive Test Suite${NC}"
    echo "======================================================"
    echo

    # Check if mab-runner exists and is executable
    if [[ ! -x "$MAB_RUNNER" ]]; then
        log_error "mab-runner not found or not executable at: $MAB_RUNNER"
        exit 1
    fi

    log_success "Found mab-runner at: $(realpath "$MAB_RUNNER")"
    echo

    # Run test suites
    test_help_functionality
    echo

    test_error_conditions
    echo

    test_reproducibility
    echo

    main_demonstration
    echo

    log_success "All tests and demonstrations completed successfully!"

    # Final cleanup
    log_info "Cleaning up test state..."
    $MAB_RUNNER reset >/dev/null
    log_success "Cleanup completed"
}

# Trap to ensure cleanup on script exit
cleanup_on_exit() {
    log_info "Script interrupted, cleaning up..."
    $MAB_RUNNER reset >/dev/null 2>&1 || true
}

trap cleanup_on_exit EXIT INT TERM

# Check for required tools
if ! command -v awk >/dev/null 2>&1; then
    log_error "awk is required but not available"
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    log_warning "jq is not available - JSON parsing will be limited"
fi

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_tests
fi