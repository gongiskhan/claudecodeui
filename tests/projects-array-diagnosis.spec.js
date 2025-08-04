import { test, expect } from '@playwright/test';

test.describe('Projects Array Diagnosis', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DIAGNOSE PROJECTS ARRAY - EXACT STRUCTURE ANALYSIS', async ({ page }) => {
    console.log('🔍 ANALYZING: Exact projects array structure passed to Sidebar');
    
    // STEP 1: Setup - ensure clean single V2 worktree
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-array-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    await page.waitForTimeout(3000);
    
    // STEP 2: Navigate and login
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 3: Inject diagnostic code to intercept React props
    console.log('🔍 Step 3: Injecting diagnostic code to intercept React props...');
    
    const projectsArrayAnalysis = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Try to hook into React rendering by patching console.log temporarily
        const originalConsoleLog = console.log;
        const results = {
          v2ProjectsFound: [],
          allProjectsFound: [],
          duplicateAnalysis: {
            byName: {},
            byDisplayName: {},
            byPath: {}
          }
        };
        
        // Look for any React component that might be rendering projects
        const interceptReactElements = () => {
          // Try to find Sidebar component data through DOM traversal
          const sidebarElements = document.querySelectorAll('[class*="sidebar"], [class*="project"]');
          
          // Also check for any exposed React debugging data
          const reactRoot = document.getElementById('root');
          if (reactRoot) {
            const fiberKey = Object.keys(reactRoot).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
            if (fiberKey) {
              const fiber = reactRoot[fiberKey];
              if (fiber) {
                results.reactFiberFound = true;
                // Try to traverse the React fiber tree to find Sidebar component
                const findSidebarProps = (node, depth = 0) => {
                  if (depth > 10) return; // Prevent infinite recursion
                  
                  if (node && node.memoizedProps && node.memoizedProps.projects) {
                    const projects = node.memoizedProps.projects;
                    if (Array.isArray(projects)) {
                      results.allProjectsFound = projects.map(p => ({
                        name: p.name,
                        displayName: p.displayName,
                        path: p.path,
                        isWorktree: p.isWorktree,
                        fullPath: p.fullPath
                      }));
                      
                      // Find V2 projects
                      results.v2ProjectsFound = projects.filter(p => 
                        p.displayName && p.displayName.includes('- V2')
                      ).map(p => ({
                        name: p.name,
                        displayName: p.displayName,
                        path: p.path,
                        isWorktree: p.isWorktree
                      }));
                      
                      // Analyze duplicates
                      projects.forEach(project => {
                        // By name
                        if (!results.duplicateAnalysis.byName[project.name]) {
                          results.duplicateAnalysis.byName[project.name] = [];
                        }
                        results.duplicateAnalysis.byName[project.name].push(project.displayName);
                        
                        // By displayName
                        if (!results.duplicateAnalysis.byDisplayName[project.displayName]) {
                          results.duplicateAnalysis.byDisplayName[project.displayName] = [];
                        }
                        results.duplicateAnalysis.byDisplayName[project.displayName].push(project.name);
                        
                        // By path
                        if (!results.duplicateAnalysis.byPath[project.path]) {
                          results.duplicateAnalysis.byPath[project.path] = [];
                        }
                        results.duplicateAnalysis.byPath[project.path].push(project.name);
                      });
                      
                      return true;
                    }
                  }
                  
                  // Traverse children
                  if (node.child) {
                    if (findSidebarProps(node.child, depth + 1)) return true;
                  }
                  if (node.sibling) {
                    if (findSidebarProps(node.sibling, depth + 1)) return true;
                  }
                  
                  return false;
                };
                
                findSidebarProps(fiber);
              }
            }
          }
          
          return results;
        };
        
        // Wait for React to render, then analyze
        setTimeout(() => {
          const analysis = interceptReactElements();
          resolve(analysis);
        }, 2000);
      });
    });
    
    console.log('📊 PROJECTS ARRAY ANALYSIS:');
    console.log('==========================');
    console.log(`🔍 React fiber found: ${projectsArrayAnalysis.reactFiberFound || false}`);
    console.log(`📋 Total projects found: ${projectsArrayAnalysis.allProjectsFound.length}`);
    console.log(`📋 V2 projects found: ${projectsArrayAnalysis.v2ProjectsFound.length}`);
    
    console.log('\n📋 ALL PROJECTS IN ARRAY:');
    projectsArrayAnalysis.allProjectsFound.forEach((project, i) => {
      console.log(`  ${i + 1}. "${project.displayName}"`);
      console.log(`      name: "${project.name}"`);
      console.log(`      path: "${project.path}"`);
      console.log(`      isWorktree: ${project.isWorktree}`);
    });
    
    console.log('\n📋 V2 PROJECTS DETAILED:');
    projectsArrayAnalysis.v2ProjectsFound.forEach((project, i) => {
      console.log(`  V2 Project ${i + 1}:`);
      console.log(`    - displayName: "${project.displayName}"`);
      console.log(`    - name: "${project.name}"`);
      console.log(`    - path: "${project.path}"`);
      console.log(`    - isWorktree: ${project.isWorktree}`);
    });
    
    console.log('\n🔍 DUPLICATE ANALYSIS:');
    console.log('=====================');
    
    const duplicateNames = Object.entries(projectsArrayAnalysis.duplicateAnalysis.byName)
      .filter(([name, displayNames]) => displayNames.length > 1);
    const duplicateDisplayNames = Object.entries(projectsArrayAnalysis.duplicateAnalysis.byDisplayName)
      .filter(([displayName, names]) => names.length > 1);
    const duplicatePaths = Object.entries(projectsArrayAnalysis.duplicateAnalysis.byPath)
      .filter(([path, names]) => names.length > 1);
    
    console.log(`📊 Duplicate names: ${duplicateNames.length}`);
    duplicateNames.forEach(([name, displayNames]) => {
      console.log(`  Name "${name}" used by: ${displayNames.join(', ')}`);
    });
    
    console.log(`📊 Duplicate displayNames: ${duplicateDisplayNames.length}`);
    duplicateDisplayNames.forEach(([displayName, names]) => {
      console.log(`  DisplayName "${displayName}" used by: ${names.join(', ')}`);
    });
    
    console.log(`📊 Duplicate paths: ${duplicatePaths.length}`);
    duplicatePaths.forEach(([path, names]) => {
      console.log(`  Path "${path}" used by: ${names.join(', ')}`);
    });
    
    // STEP 4: Compare with API data
    console.log('\n🔗 Step 4: Comparing with direct API call...');
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Projects = apiProjects.filter(p => p.displayName === 'agendamente - V2');
    
    console.log(`📊 API V2 projects: ${apiV2Projects.length}`);
    console.log(`📊 React props V2 projects: ${projectsArrayAnalysis.v2ProjectsFound.length}`);
    
    if (apiV2Projects.length !== projectsArrayAnalysis.v2ProjectsFound.length) {
      console.log('🚨 MISMATCH: API and React props return different V2 counts!');
      console.log('   This indicates duplication happening in React state management');
    }
    
    console.log('\n🎯 PROJECTS ARRAY DIAGNOSIS RESULTS:');
    console.log('===================================');
    
    if (projectsArrayAnalysis.v2ProjectsFound.length > 1) {
      console.log('🚨 DUPLICATE V2 PROJECTS IN REACT PROPS');
      console.log('   The projects array passed to Sidebar contains multiple V2 entries');
      console.log('   This is the root cause of UI duplication');
      
      if (duplicateDisplayNames.length > 0) {
        console.log('🔍 DUPLICATE displayNames detected - multiple projects have same display name');
      }
      if (duplicateNames.length > 0) {
        console.log('🔍 DUPLICATE names detected - multiple projects have same name (React key conflict)');
      }
    } else {
      console.log('✅ Single V2 project in React props (correct)');
    }
    
    // Take screenshot for reference
    await page.screenshot({ path: 'test-results/projects-array-diagnosis.png', fullPage: true });
    
    // Test assertions
    expect(projectsArrayAnalysis.v2ProjectsFound.length).toBeLessThanOrEqual(1);
    expect(duplicateDisplayNames.filter(([name]) => name.includes('V2')).length).toBe(0);
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ PROJECTS ARRAY DIAGNOSIS COMPLETE');
  });
});