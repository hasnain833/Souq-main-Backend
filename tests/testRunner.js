#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Shipping Service Tests',
        path: 'tests/shipping/shippingService.test.js',
        description: 'Tests for shipping service classes and models'
      },
      {
        name: 'Shipping Controller Tests',
        path: 'tests/shipping/shippingController.test.js',
        description: 'Tests for shipping API endpoints and controllers'
      },
      {
        name: 'Integration Tests',
        path: 'tests/shipping/integrationTests.js',
        description: 'End-to-end integration tests for delivery system'
      }
    ];
  }

  async runAllTests() {
    console.log('🚀 Starting SOUQ Delivery System Test Suite\n');
    
    const startTime = Date.now();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suite of this.testSuites) {
      console.log(`📦 Running: ${suite.name}`);
      console.log(`   ${suite.description}\n`);

      try {
        const result = await this.runTestSuite(suite.path);
        totalTests += result.total;
        passedTests += result.passed;
        failedTests += result.failed;

        if (result.failed === 0) {
          console.log(`✅ ${suite.name} - All tests passed!\n`);
        } else {
          console.log(`❌ ${suite.name} - ${result.failed} test(s) failed\n`);
        }
      } catch (error) {
        console.error(`💥 ${suite.name} - Test suite failed to run:`);
        console.error(error.message);
        failedTests++;
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%\n`);

    if (failedTests === 0) {
      console.log('🎉 All tests passed! Delivery system is ready for deployment.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review and fix before deployment.');
      process.exit(1);
    }
  }

  async runTestSuite(testPath) {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', testPath, '--verbose'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      jest.on('close', (code) => {
        const result = this.parseJestOutput(output);
        
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Jest exited with code ${code}\n${errorOutput}`));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  parseJestOutput(output) {
    // Parse Jest output to extract test results
    const lines = output.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;

    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) total/);
        if (match) {
          passed = parseInt(match[1]);
          total = parseInt(match[2]);
          failed = total - passed;
        }
      }
    }

    return { total, passed, failed };
  }

  async runSpecificTest(testName) {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(testName.toLowerCase()) ||
      s.path.includes(testName)
    );

    if (!suite) {
      console.error(`❌ Test suite "${testName}" not found`);
      console.log('\nAvailable test suites:');
      this.testSuites.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }

    console.log(`🎯 Running specific test: ${suite.name}\n`);
    
    try {
      const result = await this.runTestSuite(suite.path);
      console.log(`\n📊 Results: ${result.passed}/${result.total} tests passed`);
      
      if (result.failed === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
      } else {
        console.log(`❌ ${result.failed} test(s) failed`);
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Test failed to run:', error.message);
      process.exit(1);
    }
  }

  async generateCoverageReport() {
    console.log('📈 Generating test coverage report...\n');

    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', '--coverage', '--coverageDirectory=coverage'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      jest.on('close', (code) => {
        if (code === 0) {
          console.log('\n📊 Coverage report generated in ./coverage directory');
          console.log('🌐 Open ./coverage/lcov-report/index.html in your browser to view detailed report');
          resolve();
        } else {
          reject(new Error(`Coverage generation failed with code ${code}`));
        }
      });
    });
  }

  showHelp() {
    console.log('SOUQ Delivery System Test Runner');
    console.log('================================\n');
    console.log('Usage:');
    console.log('  node tests/testRunner.js [command] [options]\n');
    console.log('Commands:');
    console.log('  all                Run all test suites');
    console.log('  coverage          Generate coverage report');
    console.log('  <test-name>       Run specific test suite\n');
    console.log('Available test suites:');
    this.testSuites.forEach(suite => {
      console.log(`  ${suite.name}`);
      console.log(`    ${suite.description}`);
    });
    console.log('\nExamples:');
    console.log('  node tests/testRunner.js all');
    console.log('  node tests/testRunner.js shipping');
    console.log('  node tests/testRunner.js integration');
    console.log('  node tests/testRunner.js coverage');
  }
}

// Main execution
async function main() {
  const runner = new TestRunner();
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    runner.showHelp();
    return;
  }

  const command = args[0].toLowerCase();

  switch (command) {
    case 'all':
      await runner.runAllTests();
      break;
    case 'coverage':
      await runner.generateCoverageReport();
      break;
    default:
      await runner.runSpecificTest(command);
      break;
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
