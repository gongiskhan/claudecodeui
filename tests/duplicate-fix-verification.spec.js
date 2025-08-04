import { test, expect } from '@playwright/test';

test.describe('Duplicate Fix Verification', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('VERIFY DUPLICATE FIX - BACKEND API SHOULD NOT CREATE DUPLICATES', async ({ page }) => {
    console.log('🎯 TESTING: Backend duplicate fix - should eliminate API duplicates');
    
    // STEP 1: Clean slate
    console.log('🧹 Step 1: Cleaning all worktrees...');
    const versions = ['V2', 'V3', 'V4'];
    for (const version of versions) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    await page.waitForTimeout(2000);
    
    // STEP 2: Create ONE V2 worktree
    console.log('📝 Step 2: Creating ONE V2 worktree...');
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-fix-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    console.log(`✅ V2 creation status: ${createResponse.status()}`);
    expect(createResponse.ok()).toBeTruthy();
    
    await page.waitForTimeout(3000);
    
    // STEP 3: Check API state - should have EXACTLY 1 V2 worktree
    console.log('📊 Step 3: Checking API state after fix...');
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    expect(apiResponse.ok()).toBeTruthy();
    const apiProjects = await apiResponse.json();
    
    // Filter and analyze V2 projects
    const v2Projects = apiProjects.filter(p => p.displayName === 'agendamente - V2');
    const allWorktrees = apiProjects.filter(p => p.isWorktree);
    const baseProjects = apiProjects.filter(p => !p.isWorktree);
    
    console.log('📋 API Analysis:');
    console.log(`  Total projects: ${apiProjects.length}`);
    console.log(`  V2 projects: ${v2Projects.length}`);
    console.log(`  All worktrees: ${allWorktrees.length}`);
    console.log(`  Base projects: ${baseProjects.length}`);
    
    console.log('📋 All Projects:');
    apiProjects.forEach((p, index) => {
      console.log(`  ${index + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
      console.log(`      Path: ${p.path}`);
      console.log(`      Name: ${p.name}`);
    });
    
    // THE KEY TEST: Should have exactly 1 V2 project
    if (v2Projects.length === 1) {
      console.log('✅ SUCCESS: Exactly 1 V2 project (no duplicates)');
    } else {
      console.log(`🚨 FAILED: Found ${v2Projects.length} V2 projects (expected 1)`);
      
      if (v2Projects.length > 1) {
        console.log('🔍 Duplicate analysis:');
        v2Projects.forEach((p, i) => {
          console.log(`  V2 #${i + 1}: ${p.isWorktree ? 'WORKTREE' : 'BASE'} - ${p.path}`);
        });
      }
    }
    
    // Verify the V2 project is properly marked as worktree
    if (v2Projects.length > 0) {
      const v2Project = v2Projects[0];
      console.log(`🔍 V2 project details:`);
      console.log(`  - isWorktree: ${v2Project.isWorktree}`);
      console.log(`  - path: ${v2Project.path}`);
      console.log(`  - displayName: ${v2Project.displayName}`);
      
      if (v2Project.isWorktree) {
        console.log('✅ V2 project correctly marked as WORKTREE');
      } else {
        console.log('🚨 V2 project incorrectly marked as BASE');
      }
    }
    
    // Test: Should have exactly 1 V2 project
    expect(v2Projects.length).toBe(1);
    
    // Test: The V2 project should be a worktree
    expect(v2Projects[0].isWorktree).toBe(true);
    
    console.log('✅ BACKEND API DUPLICATE FIX: VERIFIED');
  });

  test('VERIFY UI DISPLAY - SHOULD SHOW ONLY 1 V2 ENTRY', async ({ page }) => {
    console.log('🎯 TESTING: UI should now show only 1 V2 entry');
    
    // Navigate to UI
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
    
    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/duplicate-fix-ui-test.png', fullPage: true });
    
    // Count V2 entries in UI
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 UI V2 count: ${uiV2Count}`);
    
    if (uiV2Count === 1) {
      console.log('✅ SUCCESS: UI shows exactly 1 V2 entry');
    } else {
      console.log(`🚨 UI STILL HAS DUPLICATES: ${uiV2Count} V2 entries visible`);
      
      // Debug: Show all V2 entries
      const v2Elements = page.locator('text=agendamente - V2');
      for (let i = 0; i < uiV2Count; i++) {
        const element = v2Elements.nth(i);
        const text = await element.textContent();
        console.log(`  UI V2 Entry ${i + 1}: "${text}"`);
      }
    }
    
    // Test: UI should show exactly 1 V2 entry
    expect(uiV2Count).toBe(1);
    
    console.log('✅ UI DUPLICATE FIX: VERIFIED');
  });

  test('COMPREHENSIVE DUPLICATE TEST - CREATE AND VERIFY', async ({ page }) => {
    console.log('🎯 COMPREHENSIVE TEST: Full create/verify/cleanup cycle');
    
    // Clean and create fresh
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-comprehensive',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    await page.waitForTimeout(3000);
    
    // Check API
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV3Count = apiProjects.filter(p => p.displayName === 'agendamente - V3').length;
    
    console.log(`📊 API V3 count: ${apiV3Count}`);
    
    // Check UI
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    const uiV3Count = await page.locator('text=agendamente - V3').count();
    console.log(`📊 UI V3 count: ${uiV3Count}`);
    
    // Both should be exactly 1
    expect(apiV3Count).toBe(1);
    expect(uiV3Count).toBe(1);
    
    console.log('✅ COMPREHENSIVE DUPLICATE TEST: PASSED');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('🎉 ALL DUPLICATE FIXES VERIFIED SUCCESSFUL!');
  });
});