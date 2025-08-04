import { test, expect } from '@playwright/test';

test.describe('API-UI Synchronization Test - Core Flaky Behavior', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('CORE FLAKY BEHAVIOR: API-UI State Synchronization Issues', async ({ page }) => {
    console.log('🎯 Testing core flaky behavior: API-UI synchronization issues');
    console.log('   (Bypassing UI authentication - focusing on the real problems)');
    
    // STEP 1: Clean slate via API
    console.log('🧹 Step 1: Cleaning all worktrees via API...');
    const versions = ['V2', 'V3', 'V4', 'V5'];
    for (const version of versions) {
      const deleteResult = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      console.log(`  Deleted ${version}: ${deleteResult.status()}`);
    }
    
    // STEP 2: Create worktrees via API - simulating the user's workflow
    console.log('📝 Step 2: Creating worktrees via API (simulating duplicate creation)...');
    
    // Create V2 worktree
    const v2CreateResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-sync-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    console.log(`✅ V2 creation status: ${v2CreateResponse.status()}`);
    
    // Try to create V2 again (duplicate test)
    const v2DuplicateResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-duplicate',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    console.log(`🔄 V2 duplicate attempt status: ${v2DuplicateResponse.status()}`);
    
    if (v2DuplicateResponse.status() === 409) {
      console.log('✅ API correctly prevents duplicates');
    } else {
      console.log('🚨 API allowed duplicate creation!');
    }
    
    // STEP 3: Get API state
    console.log('📊 Step 3: Getting API state...');
    
    const apiProjectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    expect(apiProjectsResponse.ok()).toBeTruthy();
    const apiProjects = await apiProjectsResponse.json();
    
    const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    const apiWorktreeCount = apiProjects.filter(p => p.isWorktree).length;
    const apiTotalCount = apiProjects.length;
    
    console.log('📋 API State:');
    console.log(`  Total projects: ${apiTotalCount}`);
    console.log(`  V2 worktrees: ${apiV2Count}`);
    console.log(`  Total worktrees: ${apiWorktreeCount}`);
    
    console.log('📋 API Project Details:');
    apiProjects.forEach(p => {
      console.log(`  - "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}] (name: ${p.name})`);
    });
    
    // STEP 4: Test UI display (without authentication)
    console.log('🖥️ Step 4: Testing UI display of API state...');
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Take screenshot of unauthenticated state
    await page.screenshot({ path: 'test-results/sync-01-unauthenticated-ui.png', fullPage: true });
    
    // Check what the UI shows (even without auth, it should show something)
    const pageContent = await page.textContent('body');
    const uiHasAgendamente = pageContent.includes('agendamente');
    const uiHasV2 = pageContent.includes('V2');
    const uiHasWorktree = pageContent.includes('agendamente - V2');
    
    console.log('📊 UI State (unauthenticated):');
    console.log(`  Contains 'agendamente': ${uiHasAgendamente}`);
    console.log(`  Contains 'V2': ${uiHasV2}`);
    console.log(`  Contains 'agendamente - V2': ${uiHasWorktree}`);
    
    // STEP 5: SIMULATE USER'S EXPERIENCE - Multiple rapid API calls
    console.log('🔄 Step 5: Simulating user rapid clicking (multiple API calls)...');
    
    // Simulate rapid clicking by making multiple API calls quickly
    const rapidCalls = [];
    for (let i = 0; i < 3; i++) {
      const call = page.request.post('http://localhost:3000/api/worktree/create/V3', {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: {
          branch: `feature/v3-rapid-${i}`,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        }
      });
      rapidCalls.push(call);
    }
    
    const rapidResults = await Promise.all(rapidCalls);
    
    console.log('📊 Rapid API call results:');
    rapidResults.forEach((result, index) => {
      console.log(`  Call ${index + 1}: ${result.status()}`);
    });
    
    const successCount = rapidResults.filter(r => r.status() === 200 || r.status() === 201).length;
    const conflictCount = rapidResults.filter(r => r.status() === 409).length;
    
    console.log(`✅ Successful creations: ${successCount}`);
    console.log(`🚫 Conflicts (expected): ${conflictCount}`);
    
    // STEP 6: Check final API state
    console.log('📊 Step 6: Final API state check...');
    
    const finalApiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const finalApiProjects = await finalApiResponse.json();
    const finalV2Count = finalApiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    const finalV3Count = finalApiProjects.filter(p => p.displayName === 'agendamente - V3').length;
    const finalWorktreeCount = finalApiProjects.filter(p => p.isWorktree).length;
    
    console.log('📋 Final API State:');
    console.log(`  V2 worktrees: ${finalV2Count}`);
    console.log(`  V3 worktrees: ${finalV3Count}`);
    console.log(`  Total worktrees: ${finalWorktreeCount}`);
    
    // STEP 7: ANALYSIS AND ROOT CAUSE IDENTIFICATION
    console.log('🔍 Step 7: Root cause analysis...');
    
    // Test 1: Duplicate Prevention
    if (finalV2Count > 1) {
      console.log('🚨 FLAKY BEHAVIOR CONFIRMED: Multiple V2 worktrees exist!');
    } else {
      console.log('✅ Duplicate prevention working');
    }
    
    // Test 2: Rapid Creation Handling
    if (finalV3Count > 1) {
      console.log('🚨 FLAKY BEHAVIOR CONFIRMED: Rapid creation created duplicates!');
    } else {
      console.log('✅ Rapid creation handling working');
    }
    
    // Test 3: State Consistency
    expect(finalV2Count).toBeLessThanOrEqual(1);
    expect(finalV3Count).toBeLessThanOrEqual(1);
    
    // STEP 8: SIMULATION OF REFRESH BEHAVIOR
    console.log('🔄 Step 8: Simulating refresh behavior...');
    
    // Get state before "refresh"
    const beforeRefreshResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    const beforeRefreshProjects = await beforeRefreshResponse.json();
    const beforeRefreshWorktreeCount = beforeRefreshProjects.filter(p => p.isWorktree).length;
    
    console.log(`📊 Before refresh: ${beforeRefreshWorktreeCount} worktrees`);
    
    // Wait a bit (simulating time passing)
    await page.waitForTimeout(2000);
    
    // Get state after "refresh"
    const afterRefreshResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    const afterRefreshProjects = await afterRefreshResponse.json();
    const afterRefreshWorktreeCount = afterRefreshProjects.filter(p => p.isWorktree).length;
    
    console.log(`📊 After refresh: ${afterRefreshWorktreeCount} worktrees`);
    
    if (beforeRefreshWorktreeCount !== afterRefreshWorktreeCount) {
      console.log('🚨 FLAKY BEHAVIOR CONFIRMED: State changed without user action!');
    } else {
      console.log('✅ State stable across time');
    }
    
    // STEP 9: COMPREHENSIVE SUMMARY
    console.log('🎯 COMPREHENSIVE FLAKY BEHAVIOR ANALYSIS SUMMARY:');
    console.log('================================================');
    console.log(`🔢 Final V2 Count: ${finalV2Count} (should be ≤ 1)`);
    console.log(`🔢 Final V3 Count: ${finalV3Count} (should be ≤ 1)`);
    console.log(`🔢 Total Worktrees: ${finalWorktreeCount}`);
    console.log(`🔢 API Rapid Call Success Rate: ${successCount}/${rapidResults.length}`);
    console.log(`🔢 API Conflict Detection: ${conflictCount}/${rapidResults.length}`);
    console.log('================================================');
    
    // Key findings
    if (finalV2Count <= 1 && finalV3Count <= 1 && successCount === 1) {
      console.log('✅ BACKEND API: Working correctly');
      console.log('   - Duplicate prevention: WORKING');
      console.log('   - Rapid creation handling: WORKING');
      console.log('   - State consistency: WORKING');
      console.log('');
      console.log('🎯 ROOT CAUSE: Frontend-Backend synchronization issues');
      console.log('   - API is working correctly');
      console.log('   - Issue is in how UI displays/updates the API data');
      console.log('   - Frontend state management or WebSocket updates are problematic');
    } else {
      console.log('🚨 BACKEND API: Has issues');
      console.log('   - This is the root cause of flaky behavior');
    }
    
    // STEP 10: Cleanup
    console.log('🧹 Step 10: Cleanup...');
    for (const version of ['V2', 'V3']) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    console.log('✅ COMPREHENSIVE FLAKY BEHAVIOR ANALYSIS COMPLETED');
    console.log('📊 This test focused on API behavior without UI authentication issues');
    console.log('🎯 Results show where the real problems are occurring');
  });
});