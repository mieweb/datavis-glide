#!/bin/bash
set -e

echo "Running Selenium tests..."

# Build tests if needed
if [ ! -d "tests/js" ] || [ ! -d "tests/data" ]; then
    echo "Building tests..."
    make tests
fi

# Run Mocha tests
echo "Executing Mocha tests in tests/selenium..."
npm test

echo "All Selenium tests passed!"
