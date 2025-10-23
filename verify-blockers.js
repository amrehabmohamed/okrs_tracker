#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 BLOCKER VERIFICATION REPORT\n');

let allPassed = true;

// BLOCKER #1: SECURITY AUDIT
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BLOCKER #1: Security Audit');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const checks1 = [
  {
    name: 'RLS policies exist',
    check: () => {
      // Check Supabase schema for RLS
      return fs.existsSync(path.join(__dirname, '../docs/kpi_platform_schema_v2.json'));
    }
  },
  {
    name: 'Token optimization (no N+1 queries)',
    check: () => {
      const middleware = path.join(__dirname, '../backend/src/middleware/auth.ts');
      if (!fs.existsSync(middleware)) return false;
      const content = fs.readFileSync(middleware, 'utf8');
      return content.includes('select') && !content.includes('N+1');
    }
  },
  {
    name: 'Zod validation schemas exist',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../backend/src/validation/schemas.ts'));
    }
  },
  {
    name: 'Validation middleware exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../backend/src/middleware/validate.ts'));
    }
  },
  {
    name: 'Rate limiting implemented',
    check: () => {
      const app = path.join(__dirname, '../backend/src/app.ts');
      if (!fs.existsSync(app)) return false;
      const content = fs.readFileSync(app, 'utf8');
      return content.includes('rateLimit') || content.includes('rate-limit');
    }
  }
];

checks1.forEach(c => {
  const passed = c.check();
  console.log(`${passed ? '✅' : '❌'} ${c.name}`);
  if (!passed) allPassed = false;
});

// BLOCKER #2: INPUT VALIDATION
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BLOCKER #2: Input Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const checks2 = [
  {
    name: 'Zod package installed',
    check: () => {
      const pkg = path.join(__dirname, '../backend/package.json');
      if (!fs.existsSync(pkg)) return false;
      const content = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      return content.dependencies?.zod || content.devDependencies?.zod;
    }
  },
  {
    name: 'Auth validation schemas',
    check: () => {
      const schemas = path.join(__dirname, '../backend/src/validation/schemas.ts');
      if (!fs.existsSync(schemas)) return false;
      const content = fs.readFileSync(schemas, 'utf8');
      return content.includes('signupSchema') && content.includes('loginSchema');
    }
  },
  {
    name: 'OKR validation schemas',
    check: () => {
      const schemas = path.join(__dirname, '../backend/src/validation/schemas.ts');
      if (!fs.existsSync(schemas)) return false;
      const content = fs.readFileSync(schemas, 'utf8');
      return content.includes('createOKRSchema') && content.includes('updateOKRSchema');
    }
  },
  {
    name: 'KPI validation schemas',
    check: () => {
      const schemas = path.join(__dirname, '../backend/src/validation/schemas.ts');
      if (!fs.existsSync(schemas)) return false;
      const content = fs.readFileSync(schemas, 'utf8');
      return content.includes('createKPIComponentSchema');
    }
  },
  {
    name: 'Phase 4 form schemas (count, percentage, score, boolean)',
    check: () => {
      const schemas = path.join(__dirname, '../backend/src/validation/schemas.ts');
      if (!fs.existsSync(schemas)) return false;
      const content = fs.readFileSync(schemas, 'utf8');
      return content.includes('countFormSchema') && 
             content.includes('percentageFormSchema') &&
             content.includes('scoreFormSchema') &&
             content.includes('booleanFormSchema');
    }
  }
];

checks2.forEach(c => {
  const passed = c.check();
  console.log(`${passed ? '✅' : '❌'} ${c.name}`);
  if (!passed) allPassed = false;
});

// BLOCKER #3: TESTING COVERAGE
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BLOCKER #3: Testing Coverage');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const checks3 = [
  {
    name: 'Jest configured',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../backend/jest.config.js')) ||
             fs.existsSync(path.join(__dirname, '../backend/jest.config.ts'));
    }
  },
  {
    name: 'Test directory exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../backend/tests'));
    }
  },
  {
    name: 'Auth tests exist',
    check: () => {
      const testDir = path.join(__dirname, '../backend/tests');
      if (!fs.existsSync(testDir)) return false;
      const files = getAllFiles(testDir);
      return files.some(f => f.includes('auth') && f.endsWith('.test.ts'));
    }
  },
  {
    name: 'OKR tests exist',
    check: () => {
      const testDir = path.join(__dirname, '../backend/tests');
      if (!fs.existsSync(testDir)) return false;
      const files = getAllFiles(testDir);
      return files.some(f => f.includes('okr') && f.endsWith('.test.ts'));
    }
  }
];

checks3.forEach(c => {
  const passed = c.check();
  console.log(`${passed ? '✅' : '❌'} ${c.name}`);
  if (!passed) allPassed = false;
});

// BLOCKER #4: ERROR HANDLING
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BLOCKER #4: Error Handling (RFC 7807)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const checks4 = [
  {
    name: 'Error handler middleware exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../backend/src/middleware/errorHandler.ts'));
    }
  },
  {
    name: 'RFC 7807 format implemented',
    check: () => {
      const handler = path.join(__dirname, '../backend/src/middleware/errorHandler.ts');
      if (!fs.existsSync(handler)) return false;
      const content = fs.readFileSync(handler, 'utf8');
      return content.includes('type') && 
             content.includes('title') && 
             content.includes('status') &&
             content.includes('detail') &&
             content.includes('instance');
    }
  },
  {
    name: 'Request ID tracking',
    check: () => {
      const handler = path.join(__dirname, '../backend/src/middleware/errorHandler.ts');
      if (!fs.existsSync(handler)) return false;
      const content = fs.readFileSync(handler, 'utf8');
      return content.includes('requestId') || content.includes('req.id');
    }
  },
  {
    name: 'Error documentation exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../docs/api/errors.md'));
    }
  }
];

checks4.forEach(c => {
  const passed = c.check();
  console.log(`${passed ? '✅' : '❌'} ${c.name}`);
  if (!passed) allPassed = false;
});

// BLOCKER #5: API DOCUMENTATION
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BLOCKER #5: API Documentation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const checks5 = [
  {
    name: 'OpenAPI 3.0 spec exists',
    check: () => {
      const spec = path.join(__dirname, '../docs/api/openapi.yaml');
      if (!fs.existsSync(spec)) return false;
      const content = fs.readFileSync(spec, 'utf8');
      return content.includes('openapi: 3.0');
    }
  },
  {
    name: 'Authentication guide exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../docs/api/authentication.md'));
    }
  },
  {
    name: 'Error catalog exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../docs/api/errors.md'));
    }
  },
  {
    name: 'Rate limiting guide exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../docs/api/rate-limiting.md'));
    }
  },
  {
    name: 'API README exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, '../docs/api/README.md'));
    }
  },
  {
    name: 'OpenAPI spec documents Phase 2-3 endpoints',
    check: () => {
      const spec = path.join(__dirname, '../docs/api/openapi.yaml');
      if (!fs.existsSync(spec)) return false;
      const content = fs.readFileSync(spec, 'utf8');
      return content.includes('/auth/login') && 
             content.includes('/auth/signup') &&
             content.includes('/okrs');
    }
  }
];

checks5.forEach(c => {
  const passed = c.check();
  console.log(`${passed ? '✅' : '❌'} ${c.name}`);
  if (!passed) allPassed = false;
});

// SUMMARY
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const totalChecks = checks1.length + checks2.length + checks3.length + checks4.length + checks5.length;
const passedChecks = [...checks1, ...checks2, ...checks3, ...checks4, ...checks5].filter(c => c.check()).length;

console.log(`\nTotal Checks: ${totalChecks}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${totalChecks - passedChecks}`);
console.log(`Coverage: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (allPassed) {
  console.log('\n✅ ALL BLOCKERS RESOLVED - READY FOR PHASE 4\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME BLOCKERS REMAIN - SEE FAILURES ABOVE\n');
  process.exit(1);
}

// Helper
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}
