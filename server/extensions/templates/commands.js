/**
 * Command Template Library
 * Common patterns and templates for creating commands
 */

export const COMMAND_TEMPLATES = {
  // Code Analysis Templates
  codeAnalysis: {
    name: 'Code Analysis',
    description: 'Templates for analyzing and reviewing code',
    templates: [
      {
        name: 'Analyze Function',
        description: 'Analyze a specific function for improvements',
        template: `Analyze the function \`$FUNCTION_NAME\` in the file @$FILE_PATH and provide:

1. **Code Quality Assessment**:
   - Logic clarity and readability
   - Error handling completeness
   - Performance considerations

2. **Improvement Suggestions**:
   - Refactoring opportunities
   - Better naming conventions
   - Optimization possibilities

3. **Best Practices Compliance**:
   - Language-specific conventions
   - Design pattern usage
   - Testing recommendations

Focus on: $FOCUS_AREA`,
        parameters: [
          { name: 'FUNCTION_NAME', type: 'string', required: true, description: 'Name of the function to analyze' },
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file containing the function' },
          { name: 'FOCUS_AREA', type: 'string', required: false, description: 'Specific area to focus on (performance, security, readability, etc.)' }
        ],
        tags: ['analysis', 'code-review', 'function', 'quality']
      },
      {
        name: 'Security Review',
        description: 'Review code for security vulnerabilities',
        template: `Perform a security review of the code in @$FILE_PATH focusing on:

1. **Common Vulnerabilities**:
   - Input validation issues
   - Authentication and authorization flaws
   - Data exposure risks
   - Injection vulnerabilities

2. **Security Best Practices**:
   - Secure coding patterns
   - Error handling that doesn't leak information
   - Proper secret management
   - Access control implementation

3. **Risk Assessment**:
   - Severity levels of identified issues
   - Potential impact analysis
   - Mitigation recommendations

$ADDITIONAL_CONTEXT`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file to review' },
          { name: 'ADDITIONAL_CONTEXT', type: 'string', required: false, description: 'Additional context about the application or specific concerns' }
        ],
        tags: ['security', 'review', 'vulnerability', 'audit']
      }
    ]
  },

  // Documentation Templates
  documentation: {
    name: 'Documentation',
    description: 'Templates for generating various types of documentation',
    templates: [
      {
        name: 'Generate API Documentation',
        description: 'Generate comprehensive API documentation',
        template: `Generate complete API documentation for the endpoints in @$FILE_PATH:

1. **Endpoint Overview**:
   - HTTP methods and routes
   - Purpose and functionality
   - Authentication requirements

2. **Request/Response Specifications**:
   - Request parameters and body schema
   - Response format and status codes
   - Error handling and status codes

3. **Usage Examples**:
   - cURL commands
   - JavaScript/Python examples
   - Common use cases

4. **Implementation Notes**:
   - Rate limiting information
   - Versioning strategy
   - Deprecation notices

Format: $OUTPUT_FORMAT`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the API implementation file' },
          { name: 'OUTPUT_FORMAT', type: 'string', required: false, description: 'Output format (markdown, openapi, html)' }
        ],
        tags: ['documentation', 'api', 'swagger', 'openapi']
      },
      {
        name: 'Create README',
        description: 'Generate a comprehensive README file',
        template: `Create a comprehensive README.md for the project in $PROJECT_PATH:

1. **Project Overview**:
   - Project name and description
   - Key features and benefits
   - Technology stack

2. **Getting Started**:
   - Prerequisites and requirements
   - Installation instructions
   - Quick start guide

3. **Usage Documentation**:
   - Basic usage examples
   - Configuration options
   - API reference (if applicable)

4. **Development Guide**:
   - Development setup
   - Contribution guidelines
   - Testing instructions

5. **Additional Information**:
   - License information
   - Changelog or version history
   - Support and contact information

Project focus: $PROJECT_TYPE`,
        parameters: [
          { name: 'PROJECT_PATH', type: 'directory', required: true, description: 'Path to the project directory' },
          { name: 'PROJECT_TYPE', type: 'string', required: false, description: 'Type of project (web app, library, CLI tool, etc.)' }
        ],
        tags: ['documentation', 'readme', 'getting-started', 'project']
      }
    ]
  },

  // Testing Templates
  testing: {
    name: 'Testing',
    description: 'Templates for creating tests and test strategies',
    templates: [
      {
        name: 'Generate Unit Tests',
        description: 'Generate comprehensive unit tests for a function or module',
        template: `Generate comprehensive unit tests for the $TARGET_TYPE in @$FILE_PATH:

1. **Test Structure**:
   - Test file organization
   - Setup and teardown procedures
   - Mock dependencies

2. **Test Cases**:
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling and exceptions
   - Input validation tests

3. **Test Implementation**:
   - Use $TEST_FRAMEWORK for testing
   - Include assertion examples
   - Mock external dependencies
   - Test data setup

4. **Coverage Considerations**:
   - Branch coverage scenarios
   - Statement coverage goals
   - Integration points

Focus on: $FOCUS_AREA`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file to test' },
          { name: 'TARGET_TYPE', type: 'string', required: true, description: 'What to test (function, class, module)' },
          { name: 'TEST_FRAMEWORK', type: 'string', required: false, description: 'Testing framework to use (Jest, Mocha, pytest, etc.)' },
          { name: 'FOCUS_AREA', type: 'string', required: false, description: 'Specific testing focus (error handling, performance, integration)' }
        ],
        tags: ['testing', 'unit-tests', 'jest', 'coverage']
      },
      {
        name: 'Test Strategy',
        description: 'Create a comprehensive testing strategy document',
        template: `Create a comprehensive testing strategy for the $PROJECT_TYPE project:

1. **Testing Pyramid**:
   - Unit testing approach and coverage goals
   - Integration testing strategy
   - End-to-end testing requirements
   - Manual testing processes

2. **Testing Tools and Frameworks**:
   - Recommended testing tools
   - CI/CD integration requirements
   - Code coverage tools and thresholds
   - Performance testing tools

3. **Test Data Management**:
   - Test data creation strategies
   - Data isolation and cleanup
   - Environment management
   - Sensitive data handling

4. **Quality Gates**:
   - Definition of done criteria
   - Code coverage requirements
   - Performance benchmarks
   - Release criteria

Target environment: $ENVIRONMENT`,
        parameters: [
          { name: 'PROJECT_TYPE', type: 'string', required: true, description: 'Type of project (web application, API, library, etc.)' },
          { name: 'ENVIRONMENT', type: 'string', required: false, description: 'Target environment (web, mobile, desktop, embedded)' }
        ],
        tags: ['testing', 'strategy', 'qa', 'planning']
      }
    ]
  },

  // Refactoring Templates
  refactoring: {
    name: 'Refactoring',
    description: 'Templates for code refactoring and improvement',
    templates: [
      {
        name: 'Extract Function',
        description: 'Refactor code by extracting reusable functions',
        template: `Analyze the code in @$FILE_PATH and suggest function extractions:

1. **Identify Opportunities**:
   - Repeated code patterns
   - Complex inline logic
   - Long functions that can be broken down
   - Code that violates single responsibility principle

2. **Extraction Recommendations**:
   - Suggested function names and signatures
   - Parameter and return value definitions
   - Appropriate access levels and scope
   - Error handling considerations

3. **Refactored Code**:
   - Show before and after code examples
   - Maintain existing functionality
   - Improve readability and maintainability
   - Consider performance implications

4. **Testing Impact**:
   - Required test updates
   - New test cases for extracted functions
   - Integration testing considerations

Focus area: $FOCUS_AREA`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file to refactor' },
          { name: 'FOCUS_AREA', type: 'string', required: false, description: 'Specific refactoring focus (complexity, duplication, performance)' }
        ],
        tags: ['refactoring', 'clean-code', 'functions', 'maintainability']
      },
      {
        name: 'Modernize Code',
        description: 'Update legacy code to modern standards',
        template: `Modernize the legacy code in @$FILE_PATH to current $LANGUAGE standards:

1. **Language Features**:
   - Use modern syntax and language features
   - Update deprecated APIs and methods
   - Improve type safety and null handling
   - Leverage new standard library features

2. **Design Patterns**:
   - Apply current best practices
   - Update architectural patterns
   - Improve error handling patterns
   - Enhance async/await usage

3. **Performance Improvements**:
   - Optimize algorithms and data structures
   - Reduce memory allocations
   - Improve resource management
   - Update to efficient APIs

4. **Maintainability Enhancements**:
   - Improve code organization
   - Add proper documentation
   - Enhance readability
   - Reduce technical debt

Target version: $TARGET_VERSION`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the legacy code file' },
          { name: 'LANGUAGE', type: 'string', required: true, description: 'Programming language (JavaScript, Python, Java, etc.)' },
          { name: 'TARGET_VERSION', type: 'string', required: false, description: 'Target language/framework version' }
        ],
        tags: ['modernization', 'legacy', 'upgrade', 'best-practices']
      }
    ]
  },

  // Debugging Templates
  debugging: {
    name: 'Debugging',
    description: 'Templates for debugging and troubleshooting',
    templates: [
      {
        name: 'Debug Analysis',
        description: 'Analyze code for potential bugs and issues',
        template: `Analyze the code in @$FILE_PATH to identify potential bugs and issues:

1. **Bug Detection**:
   - Logic errors and edge cases
   - Memory leaks and resource issues
   - Concurrency and race conditions
   - Null pointer and undefined value risks

2. **Error Handling Analysis**:
   - Missing error handling
   - Improper exception propagation
   - Resource cleanup issues
   - Error message quality

3. **Data Flow Analysis**:
   - Variable initialization issues
   - Scope and lifetime problems
   - Data validation gaps
   - Input sanitization concerns

4. **Debugging Recommendations**:
   - Suggested logging points
   - Debugging tools and techniques
   - Test cases to reproduce issues
   - Monitoring and alerting suggestions

Error context: $ERROR_DESCRIPTION`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file to debug' },
          { name: 'ERROR_DESCRIPTION', type: 'string', required: false, description: 'Description of the error or issue being investigated' }
        ],
        tags: ['debugging', 'bug-analysis', 'troubleshooting', 'error-handling']
      }
    ]
  },

  // Performance Templates
  performance: {
    name: 'Performance',
    description: 'Templates for performance analysis and optimization',
    templates: [
      {
        name: 'Performance Audit',
        description: 'Comprehensive performance analysis of code',
        template: `Perform a comprehensive performance audit of @$FILE_PATH:

1. **Performance Bottlenecks**:
   - CPU-intensive operations
   - Memory usage patterns
   - I/O and network operations
   - Algorithm complexity analysis

2. **Optimization Opportunities**:
   - Caching strategies
   - Data structure improvements
   - Algorithm optimizations
   - Resource pooling options

3. **Benchmarking**:
   - Performance measurement points
   - Baseline metrics to establish
   - Load testing considerations
   - Scalability analysis

4. **Implementation Recommendations**:
   - Specific optimization techniques
   - Trade-offs and considerations
   - Monitoring and alerting setup
   - Performance regression prevention

Performance target: $PERFORMANCE_GOAL`,
        parameters: [
          { name: 'FILE_PATH', type: 'file', required: true, description: 'Path to the file to audit' },
          { name: 'PERFORMANCE_GOAL', type: 'string', required: false, description: 'Specific performance goal or requirement' }
        ],
        tags: ['performance', 'optimization', 'benchmarking', 'scalability']
      }
    ]
  }
};

/**
 * Get all available command templates
 */
export function getAllTemplates() {
  const allTemplates = [];
  
  Object.entries(COMMAND_TEMPLATES).forEach(([categoryKey, category]) => {
    category.templates.forEach(template => {
      allTemplates.push({
        ...template,
        category: category.name,
        categoryKey
      });
    });
  });
  
  return allTemplates;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(categoryKey) {
  return COMMAND_TEMPLATES[categoryKey]?.templates || [];
}

/**
 * Get template categories
 */
export function getTemplateCategories() {
  return Object.entries(COMMAND_TEMPLATES).map(([key, category]) => ({
    key,
    name: category.name,
    description: category.description,
    count: category.templates.length
  }));
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query) {
  const allTemplates = getAllTemplates();
  const lowerQuery = query.toLowerCase();
  
  return allTemplates.filter(template => 
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export default COMMAND_TEMPLATES;