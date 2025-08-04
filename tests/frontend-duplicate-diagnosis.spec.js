import { test, expect } from '@playwright/test';

test.describe('Frontend Duplicate Diagnosis', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DIAGNOSE FRONTEND DUPLICATION - ANALYZE REACT PROPS', async ({ page }) => {
    console.log('🔍 DIAGNOSING: Frontend React props causing UI duplication');
    
    // STEP 1: Clean slate - ensure only one V2 exists
    console.log('🧹 Step 1: Cleaning and creating single V2 worktree...');
    
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.waitForTimeout(1000);
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-diagnosis',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    await page.waitForTimeout(3000);
    
    // STEP 2: Verify API state is correct (should be 1 V2)
    console.log('📊 Step 2: Verifying API returns exactly 1 V2 project...');
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Projects = apiProjects.filter(p => p.displayName === 'agendamente - V2');
    
    console.log(`📋 API V2 projects: ${apiV2Projects.length}`);
    console.log('📋 API projects structure:');
    apiProjects.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
      console.log(`      name: "${p.name}"`);
      console.log(`      path: "${p.path}"`);
    });
    
    expect(apiV2Projects.length).toBe(1);
    
    // STEP 3: Navigate to UI and inject diagnostic code
    console.log('🌐 Step 3: Navigating to UI and injecting diagnostic code...');
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Login
    const usernameField = page.locator('input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await passwordField.fill('testpass123');
      await submitButton.click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 4: Inject diagnostic code to examine React props
    console.log('🔍 Step 4: Injecting diagnostic code to examine React props...');
    
    const diagnosticResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Find the Sidebar component in the React DevTools
        const findReactProps = () => {
          // Look for elements that might contain React props
          const elements = document.querySelectorAll('[class*="space-y"], [class*="projects"]');
          const results = {
            elementsFound: elements.length,
            v2ElementsFound: 0,
            reactFiberData: [],
            elementDetails: []
          };
          
          // Count V2 elements in DOM
          const v2Elements = document.querySelectorAll('*');
          for (let elem of v2Elements) {
            if (elem.textContent && elem.textContent.includes('agendamente - V2')) {
              results.v2ElementsFound++;
              results.elementDetails.push({
                tagName: elem.tagName,
                className: elem.className,
                textContent: elem.textContent.substring(0, 100),
                innerHTML: elem.innerHTML.substring(0, 200)
              });
            }
          }
          
          // Try to access React fiber data
          elements.forEach((elem, index) => {
            const fiberKey = Object.keys(elem).find(key => key.startsWith('__reactFiber'));
            if (fiberKey) {
              const fiber = elem[fiberKey];
              if (fiber && fiber.memoizedProps) {
                results.reactFiberData.push({
                  elementIndex: index,
                  propsKeys: Object.keys(fiber.memoizedProps),
                  hasProjects: 'projects' in fiber.memoizedProps,
                  projectsLength: fiber.memoizedProps.projects ? fiber.memoizedProps.projects.length : 0
                });
              }
            }
          });
          
          return results;
        };
        
        // Wait a moment for React to render, then collect data
        setTimeout(() => {
          const results = findReactProps();
          resolve(results);
        }, 2000);
      });
    });
    
    console.log('🔍 DIAGNOSTIC RESULTS:');
    console.log('====================');
    console.log(`📊 DOM elements found: ${diagnosticResults.elementsFound}`);
    console.log(`📊 V2 elements in DOM: ${diagnosticResults.v2ElementsFound}`);
    console.log(`📊 React fiber data found: ${diagnosticResults.reactFiberData.length}`);
    
    if (diagnosticResults.reactFiberData.length > 0) {
      console.log('📋 React Props Analysis:');
      diagnosticResults.reactFiberData.forEach((fiber, i) => {
        console.log(`  Fiber ${i + 1}:`);
        console.log(`    - Props keys: ${fiber.propsKeys.join(', ')}`);
        console.log(`    - Has projects prop: ${fiber.hasProjects}`);
        console.log(`    - Projects array length: ${fiber.projectsLength}`);
      });
    }
    
    console.log('📋 V2 Element Details:');
    diagnosticResults.elementDetails.forEach((elem, i) => {
      console.log(`  Element ${i + 1}:`);
      console.log(`    - Tag: ${elem.tagName}`);
      console.log(`    - Class: ${elem.className}`);
      console.log(`    - Text: "${elem.textContent}"`);
    });
    
    // STEP 5: Try to access the window object for more data
    console.log('🔍 Step 5: Checking for global debugging data...');
    
    const globalData = await page.evaluate(() => {
      // Check if there are any global variables that might give us insights
      const results = {
        hasReact: typeof window.React !== 'undefined',
        hasReactDOM: typeof window.ReactDOM !== 'undefined',
        windowKeys: Object.keys(window).filter(key => key.toLowerCase().includes('react') || key.toLowerCase().includes('props')),
        bodyText: document.body.textContent || '',
        v2Count: (document.body.textContent || '').split('agendamente - V2').length - 1
      };
      
      return results;
    });
    
    console.log('🌐 Global Environment:');
    console.log(`  - Has React: ${globalData.hasReact}`);
    console.log(`  - Has ReactDOM: ${globalData.hasReactDOM}`);
    console.log(`  - React-related window keys: ${globalData.windowKeys.join(', ')}`);
    console.log(`  - V2 count in body text: ${globalData.v2Count}`);
    
    // STEP 6: Take screenshot for analysis
    await page.screenshot({ path: 'test-results/frontend-duplicate-diagnosis.png', fullPage: true });
    
    // STEP 7: Summary analysis
    console.log('🎯 FRONTEND DUPLICATION DIAGNOSIS:');
    console.log('===============================');
    console.log(`📊 API returns: 1 V2 project`);
    console.log(`📊 DOM shows: ${globalData.v2Count} V2 entries`);
    console.log(`📊 React elements found: ${diagnosticResults.v2ElementsFound}`);
    
    if (globalData.v2Count > 1) {
      console.log('🚨 CONFIRMED: Frontend is duplicating the single API project');
      console.log('🔍 POSSIBLE CAUSES:');
      console.log('   1. React component is rendering the same project multiple times');
      console.log('   2. State management is duplicating projects in the array');
      console.log('   3. WebSocket updates are adding duplicates');
      console.log('   4. Key prop issues causing React to render multiple instances');
      console.log('   5. Parent component is passing duplicate projects in props');
    }
    
    // Clean up
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ FRONTEND DIAGNOSIS COMPLETE');
  });
});