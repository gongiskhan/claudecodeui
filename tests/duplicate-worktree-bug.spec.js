import { test, expect } from '@playwright/test';

test.describe('Duplicate Worktree Bug Detection and Fix', () => {
  let authToken = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Try existing user first, then create if needed
    let loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'testuser', password: 'testpass123' }
    });
    
    if (!loginResponse.ok()) {
      console.log('⚠️ testuser login failed, trying ggomes...');
      loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
        data: { username: 'ggomes', password: '2WS4rf3ed!' }
      });
    }
    
    if (!loginResponse.ok()) {
      console.log('⚠️ Both logins failed, trying to register ggomes...');
      loginResponse = await page.request.post('http://localhost:3000/api/auth/register', {
        data: { username: 'ggomes', password: '2WS4rf3ed!' }
      });
    }
    
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      console.log('✅ Auth token obtained');
    } else {
      console.log('❌ Login failed:', loginResponse.status());
    }
    
    await context.close();
  });

  test('1. Clean State - Remove All Existing Worktrees', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Cleaning all existing worktrees...');
    
    // Get current projects
    const response = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.ok()).toBeTruthy();
    const projects = await response.json();
    
    console.log('📋 Current projects:');
    projects.forEach(p => {
      console.log(`  - ${p.displayName} [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
    });
    
    // Find all worktree projects
    const worktreeProjects = projects.filter(p => p.isWorktree);
    console.log(`🔍 Found ${worktreeProjects.length} worktree projects`);
    
    // Delete all worktrees
    const versions = ['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'];
    for (const version of versions) {
      const deleteResponse = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (deleteResponse.ok()) {
        console.log(`✅ Deleted ${version} worktree`);
      } else {
        console.log(`ℹ️ ${version} worktree not found`);
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Verify clean state
    const cleanResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const cleanProjects = await cleanResponse.json();
    const remainingWorktrees = cleanProjects.filter(p => p.isWorktree);
    
    console.log(`🎯 Remaining worktrees after cleanup: ${remainingWorktrees.length}`);
    expect(remainingWorktrees.length).toBe(0);
  });

  test('2. Test Single V2 Creation - Should Create Only One', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🌳 Testing single V2 worktree creation...');
    
    // Create V2 worktree
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-single',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (createResponse.ok()) {
      console.log('✅ V2 worktree creation request successful');
    } else {
      const error = await createResponse.text();
      console.log('❌ V2 worktree creation failed:', createResponse.status(), error);
    }
    
    await page.waitForTimeout(3000);
    
    // Check how many V2 worktrees exist
    const projectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const projects = await projectsResponse.json();
    const v2Projects = projects.filter(p => 
      p.displayName === 'agendamente - V2' && p.isWorktree === true
    );
    
    console.log('📋 All projects after V2 creation:');
    projects.forEach(p => {
      console.log(`  - ${p.displayName} [${p.isWorktree ? 'WORKTREE' : 'BASE'}] (${p.name})`);
    });
    
    console.log(`🔍 V2 worktree count: ${v2Projects.length}`);
    
    // TEST: Should only have exactly ONE V2 worktree
    expect(v2Projects.length).toBe(1);
    
    if (v2Projects.length > 1) {
      console.log('🚨 BUG DETECTED: Multiple V2 worktrees created!');
      v2Projects.forEach((p, index) => {
        console.log(`  V2 #${index + 1}: Name="${p.name}", Path="${p.path}"`);
      });
    } else {
      console.log('✅ Correct: Only one V2 worktree created');
    }
  });

  test('3. Test Double V2 Creation - Should Not Create Duplicate', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🔄 Testing duplicate V2 worktree creation prevention...');
    
    // Get current V2 count
    let beforeResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const beforeProjects = await beforeResponse.json();
    const beforeV2Count = beforeProjects.filter(p => 
      p.displayName === 'agendamente - V2' && p.isWorktree === true
    ).length;
    
    console.log(`📊 V2 worktrees before duplicate attempt: ${beforeV2Count}`);
    
    // Try to create V2 again (should fail or be ignored)
    const duplicateResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-duplicate',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    console.log(`🔄 Duplicate V2 creation response: ${duplicateResponse.status()}`);
    
    if (duplicateResponse.ok()) {
      console.log('⚠️ Duplicate creation was allowed (this might be the bug)');
    } else {
      const error = await duplicateResponse.text();
      console.log('✅ Duplicate creation was rejected:', error);
    }
    
    await page.waitForTimeout(3000);
    
    // Check V2 count after duplicate attempt
    let afterResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const afterProjects = await afterResponse.json();
    const afterV2Count = afterProjects.filter(p => 
      p.displayName === 'agendamente - V2' && p.isWorktree === true
    ).length;
    
    console.log(`📊 V2 worktrees after duplicate attempt: ${afterV2Count}`);
    
    // TEST: Should still have exactly the same number (no duplicates created)
    expect(afterV2Count).toBe(beforeV2Count);
    
    if (afterV2Count > beforeV2Count) {
      console.log('🚨 BUG CONFIRMED: Duplicate V2 worktree was created!');
    } else {
      console.log('✅ Correct: No duplicate V2 worktree created');
    }
  });

  test('4. Test Multiple Different Versions - Should Work Correctly', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🌳 Testing multiple different version creation...');
    
    // Create V3 and V4 worktrees
    const versions = ['V3', 'V4'];
    
    for (const version of versions) {
      const response = await page.request.post(`http://localhost:3000/api/worktree/create/${version}`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          branch: `feature/${version.toLowerCase()}-test`,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        }
      });
      
      if (response.ok()) {
        console.log(`✅ ${version} worktree created`);
      } else {
        console.log(`❌ ${version} worktree creation failed:`, response.status());
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Verify all versions exist uniquely
    const projectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const projects = await projectsResponse.json();
    const worktreeProjects = projects.filter(p => p.isWorktree);
    
    console.log('📋 All worktree projects:');
    worktreeProjects.forEach(p => {
      console.log(`  - ${p.displayName} (${p.name})`);
    });
    
    // Check for each version
    const v2Count = projects.filter(p => p.displayName === 'agendamente - V2').length;
    const v3Count = projects.filter(p => p.displayName === 'agendamente - V3').length;
    const v4Count = projects.filter(p => p.displayName === 'agendamente - V4').length;
    
    console.log(`🔢 Version counts - V2: ${v2Count}, V3: ${v3Count}, V4: ${v4Count}`);
    
    // Each version should exist exactly once
    expect(v2Count).toBe(1);
    expect(v3Count).toBe(1);
    expect(v4Count).toBe(1);
  });

  test('5. Test UI Load - Should Show Each Version Once', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🖥️ Testing UI display of worktrees...');
    
    // Navigate to UI
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/duplicate-worktree-test.png', fullPage: true });
    
    // Check page content
    const pageText = await page.textContent('body');
    
    // Count occurrences of each version in the UI
    const v2Matches = (pageText.match(/agendamente - V2/g) || []).length;
    const v3Matches = (pageText.match(/agendamente - V3/g) || []).length;
    const v4Matches = (pageText.match(/agendamente - V4/g) || []).length;
    
    console.log(`🔍 UI text matches - V2: ${v2Matches}, V3: ${v3Matches}, V4: ${v4Matches}`);
    
    // Each version should appear exactly once in the UI
    expect(v2Matches).toBe(1);
    expect(v3Matches).toBe(1);
    expect(v4Matches).toBe(1);
    
    if (v2Matches > 1 || v3Matches > 1 || v4Matches > 1) {
      console.log('🚨 UI BUG: Duplicate entries shown in interface');
    } else {
      console.log('✅ UI correctly shows each version once');
    }
  });

  test('6. Cleanup and Final Verification', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Final cleanup...');
    
    // Delete all test worktrees
    const versions = ['V2', 'V3', 'V4'];
    for (const version of versions) {
      const deleteResponse = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (deleteResponse.ok()) {
        console.log(`✅ Deleted ${version} worktree`);
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Final verification
    const finalResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const finalProjects = await finalResponse.json();
    const finalWorktrees = finalProjects.filter(p => p.isWorktree);
    
    console.log(`🎯 Final worktree count: ${finalWorktrees.length}`);
    expect(finalWorktrees.length).toBe(0);
    
    console.log('🎉 Duplicate worktree test completed');
  });
});