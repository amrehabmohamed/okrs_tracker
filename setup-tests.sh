#!/bin/bash

# Create test directory structure
mkdir -p backend/tests/integration
mkdir -p backend/tests/unit

# Install test dependencies if needed
cd backend
npm install --save-dev @types/jest @types/supertest supertest jest ts-jest

# Initialize Jest config if not exists
if [ ! -f jest.config.js ]; then
  cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
EOF
fi

# Add test scripts to package.json
npm pkg set scripts.test="jest"
npm pkg set scripts.test:coverage="jest --coverage"
npm pkg set scripts.test:watch="jest --watch"

echo "✅ Test setup complete"
echo "Run: npm test"
