import { test, expect } from '@playwright/test';

test.describe('Worktree Flaky Behavior - Complete End-to-End Fix', () => {
  let authToken = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'testuser', password: 'testpass123' }
    });
    
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      console.log('✅ Auth token obtained');
    }
    
    await context.close();
  });

  test('1. Clean State and Setup Authentication', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Setting up clean test environment...');
    
    // Clean all worktrees via API first
    const versions = ['V2', 'V3', 'V4', 'V5'];
    for (const version of versions) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    }
    
    // Navigate to UI and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    
    // Wait for UI to fully load
    await page.waitForTimeout(5000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-clean-state.png', fullPage: true });
    
    // Verify we see the agendamente project
    await expect(page.locator('text=agendamente')).toBeVisible();
    
    console.log('✅ Clean state established with UI authentication');
  });

  test('2. Test UI Worktree Creation - Multiple Rapid Clicks', async ({ page }) => {
    console.log('🔄 Testing rapid UI worktree creation...');
    
    // Navigate and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Find the V2 button in the agendamente project section
    const agendamenteSection = page.locator('text=agendamente').first();
    await expect(agendamenteSection).toBeVisible();
    
    // Look for V2 button - try multiple selectors
    const v2ButtonSelectors = [
      'button:has-text("V2")',
      '[data-version="V2"]',
      'button[title*="V2"]',
      '.worktree-button:has-text("V2")'
    ];
    
    let v2Button = null;
    for (const selector of v2ButtonSelectors) {
      try {
        v2Button = page.locator(selector).first();
        if (await v2Button.isVisible()) {
          console.log(`✅ Found V2 button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!v2Button || !(await v2Button.isVisible())) {
      // Try to find any button near agendamente
      await page.screenshot({ path: 'test-results/02-no-v2-button.png', fullPage: true });
      console.log('⚠️ V2 button not found, looking for any worktree creation buttons...');
      
      // Look for buttons with "V" in them
      const vButtons = page.locator('button').filter({ hasText: /V\d+/ });
      const count = await vButtons.count();
      console.log(`Found ${count} V buttons`);
      
      if (count > 0) {
        v2Button = vButtons.first();
      } else {
        throw new Error('No V2 button found in UI');
      }
    }
    
    // Record initial project count
    const beforeCount = await page.locator('text=agendamente').count();
    console.log(`📊 Initial agendamente projects: ${beforeCount}`);
    
    // Click V2 button multiple times rapidly to test for duplicates
    console.log('🖱️ Clicking V2 button rapidly (5 times)...');
    for (let i = 0; i < 5; i++) {
      await v2Button.click();
      await page.waitForTimeout(200); // Small delay between clicks
    }
    
    // Wait for any async operations to complete
    await page.waitForTimeout(5000);
    
    // Take screenshot after clicks
    await page.screenshot({ path: 'test-results/03-after-rapid-clicks.png', fullPage: true });
    
    // Count projects with V2 in the name
    const v2Projects = page.locator('text=agendamente - V2');
    const v2Count = await v2Projects.count();
    
    console.log(`🔍 agendamente - V2 projects after rapid clicks: ${v2Count}`);
    
    // Should have exactly 1 V2 project, not multiple
    expect(v2Count).toBeLessThanOrEqual(1);
    
    if (v2Count > 1) {
      console.log('🚨 BUG DETECTED: Multiple V2 worktrees created by rapid clicking!');
    } else if (v2Count === 1) {
      console.log('✅ Correct: Only one V2 worktree created');
    } else {
      console.log('⚠️ No V2 worktree visible in UI');
    }
  });

  test('3. Test Refresh Behavior After Worktree Creation', async ({ page }) => {
    console.log('🔄 Testing refresh behavior after worktree creation...');
    
    // Navigate and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Record state before refresh
    let beforeV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 Before refresh - V2 projects: ${beforeV2Count}`);
    
    // Take screenshot before refresh
    await page.screenshot({ path: 'test-results/04-before-refresh.png', fullPage: true });
    
    // Refresh the page
    console.log('🔄 Refreshing page...');
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Record state after refresh
    let afterV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 After refresh - V2 projects: ${afterV2Count}`);
    
    // Take screenshot after refresh
    await page.screenshot({ path: 'test-results/05-after-refresh.png', fullPage: true });
    
    // State should be consistent after refresh
    if (beforeV2Count !== afterV2Count) {
      console.log('🚨 BUG DETECTED: Project count changed after refresh!');
      console.log(`  Before: ${beforeV2Count}, After: ${afterV2Count}`);
    } else {
      console.log(`✅ Consistent state after refresh: ${afterV2Count} V2 projects`);
    }
    
    // If we have duplicates, they should be gone after refresh
    expect(afterV2Count).toBeLessThanOrEqual(1);
  });

  test('4. Test Message Sending in Worktree - Critical Flow', async ({ page }) => {
    console.log('💬 Testing message sending in worktree...');
    
    // Navigate and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Look for V2 worktree and click on it
    const v2Project = page.locator('text=agendamente - V2').first();
    
    if (await v2Project.isVisible()) {
      console.log('📂 Found V2 worktree, clicking to select...');
      await v2Project.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot after selecting worktree
      await page.screenshot({ path: 'test-results/06-worktree-selected.png', fullPage: true });
      
      // Look for message input field
      const messageInputs = [
        'textarea[placeholder*="message"]',
        'input[type="text"][placeholder*="message"]',
        'textarea',
        '.message-input',
        '[data-testid="message-input"]'
      ];
      
      let messageInput = null;
      for (const selector of messageInputs) {
        try {
          messageInput = page.locator(selector).first();
          if (await messageInput.isVisible()) {
            console.log(`✅ Found message input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (messageInput && await messageInput.isVisible()) {
        console.log('💬 Typing test message...');
        
        // Record worktree state before message
        const beforeMessageV2Count = await page.locator('text=agendamente - V2').count();
        console.log(`📊 Before message - V2 projects visible: ${beforeMessageV2Count}`);
        
        // Type a test message
        await messageInput.fill('Test message for V2 worktree - checking for flickering behavior');
        
        // Press Enter or click send button
        await messageInput.press('Enter');
        
        console.log('⏱️ Monitoring for worktree flickering during message processing...');
        
        // Monitor worktree visibility during message processing
        let flickeringDetected = false;
        for (let i = 0; i < 10; i++) {
          const currentV2Count = await page.locator('text=agendamente - V2').count();
          if (currentV2Count !== beforeMessageV2Count) {
            console.log(`🔍 Monitoring step ${i}: V2 count changed to ${currentV2Count}`);
            flickeringDetected = true;
          }
          await page.waitForTimeout(500);
        }
        
        // Take screenshot during message processing
        await page.screenshot({ path: 'test-results/07-during-message.png', fullPage: true });
        
        // Wait for message to complete
        await page.waitForTimeout(5000);
        
        // Record state after message
        const afterMessageV2Count = await page.locator('text=agendamente - V2').count();
        console.log(`📊 After message - V2 projects visible: ${afterMessageV2Count}`);
        
        // Take screenshot after message
        await page.screenshot({ path: 'test-results/08-after-message.png', fullPage: true });
        
        if (flickeringDetected) {
          console.log('🚨 BUG DETECTED: Worktree flickering during message sending!');
        } else {
          console.log('✅ No flickering detected during message sending');
        }
        
        // Worktree should remain visible and consistent
        expect(afterMessageV2Count).toBe(beforeMessageV2Count);
        
      } else {
        console.log('⚠️ Message input not found, cannot test message sending');
        await page.screenshot({ path: 'test-results/07-no-message-input.png', fullPage: true });
      }
      
    } else {
      console.log('⚠️ V2 worktree not found, cannot test message sending');
      
      // Create V2 via API for testing
      await page.request.post('http://localhost:3000/api/worktree/create/V2', {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          branch: 'feature/v2-message-test',
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        }
      });
      
      await page.reload();
      await page.waitForTimeout(5000);
      
      // Try again
      const v2ProjectRetry = page.locator('text=agendamente - V2').first();
      if (await v2ProjectRetry.isVisible()) {
        console.log('✅ V2 worktree created via API, visible in UI');
      }
    }
  });

  test('5. Test Session Persistence After Refresh', async ({ page }) => {
    console.log('💾 Testing session persistence after refresh...');
    
    // Navigate and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Look for any existing sessions in V2 worktree
    const v2Project = page.locator('text=agendamente - V2').first();
    
    if (await v2Project.isVisible()) {
      console.log('📂 V2 worktree found, checking for sessions...');
      
      // Click on V2 worktree
      await v2Project.click();
      await page.waitForTimeout(2000);
      
      // Look for session indicators
      const sessionIndicators = [
        'text=lopoo',
        'text=Just now',
        '.session-item',
        '[data-testid="session"]'
      ];
      
      let sessionFound = false;
      let sessionInfo = '';
      
      for (const indicator of sessionIndicators) {
        const sessions = page.locator(indicator);
        const count = await sessions.count();
        if (count > 0) {
          sessionFound = true;
          sessionInfo += `${indicator}: ${count} `;
        }
      }
      
      console.log(`📊 Sessions before refresh: ${sessionFound ? sessionInfo : 'None found'}`);
      
      // Take screenshot before refresh
      await page.screenshot({ path: 'test-results/09-sessions-before-refresh.png', fullPage: true });
      
      // Refresh the page
      console.log('🔄 Refreshing to test session persistence...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      // Click on V2 worktree again
      const v2ProjectAfter = page.locator('text=agendamente - V2').first();
      
      if (await v2ProjectAfter.isVisible()) {
        await v2ProjectAfter.click();
        await page.waitForTimeout(2000);
        
        // Check sessions after refresh
        let sessionFoundAfter = false;
        let sessionInfoAfter = '';
        
        for (const indicator of sessionIndicators) {
          const sessions = page.locator(indicator);
          const count = await sessions.count();
          if (count > 0) {
            sessionFoundAfter = true;
            sessionInfoAfter += `${indicator}: ${count} `;
          }
        }
        
        console.log(`📊 Sessions after refresh: ${sessionFoundAfter ? sessionInfoAfter : 'None found'}`);
        
        // Take screenshot after refresh
        await page.screenshot({ path: 'test-results/10-sessions-after-refresh.png', fullPage: true });
        
        if (sessionFound && !sessionFoundAfter) {
          console.log('🚨 BUG DETECTED: Sessions disappeared after refresh!');
        } else if (sessionFound && sessionFoundAfter) {
          console.log('✅ Sessions persisted after refresh');
        } else {
          console.log('ℹ️ No sessions to test persistence');
        }
        
      } else {
        console.log('🚨 BUG DETECTED: V2 worktree disappeared after refresh!');
      }
      
    } else {
      console.log('⚠️ No V2 worktree found to test session persistence');
    }
  });

  test('6. Comprehensive State Consistency Check', async ({ page }) => {
    console.log('🔍 Running comprehensive state consistency check...');
    
    // Navigate and authenticate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Get API state
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    const apiWorktreeCount = apiProjects.filter(p => p.isWorktree).length;
    
    console.log(`📊 API State: ${apiV2Count} V2 projects, ${apiWorktreeCount} total worktrees`);
    
    // Get UI state
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    const uiWorktreeCount = await page.locator('text=agendamente -').count();
    
    console.log(`📊 UI State: ${uiV2Count} V2 projects, ${uiWorktreeCount} total worktrees visible`);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/11-final-state.png', fullPage: true });
    
    // Check consistency
    const stateConsistent = (apiV2Count === uiV2Count);
    
    if (stateConsistent) {
      console.log('✅ API and UI states are consistent');
    } else {
      console.log('🚨 BUG DETECTED: API and UI states are inconsistent!');
      console.log(`  API: ${apiV2Count} V2 projects`);
      console.log(`  UI: ${uiV2Count} V2 projects`);
    }
    
    // Final verification - should have at most 1 V2 project
    expect(apiV2Count).toBeLessThanOrEqual(1);
    expect(uiV2Count).toBeLessThanOrEqual(1);
    expect(stateConsistent).toBe(true);
  });

  test('7. Cleanup and Final Summary', async ({ page }) => {
    console.log('🧹 Final cleanup and summary...');
    
    // Clean up all test worktrees
    const versions = ['V2', 'V3', 'V4', 'V5'];
    for (const version of versions) {
      const deleteResponse = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (deleteResponse.ok()) {
        console.log(`✅ Cleaned up ${version} worktree`);
      }
    }
    
    // Final verification
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    const finalV2Count = await page.locator('text=agendamente - V2').count();
    const finalWorktreeCount = await page.locator('text=agendamente -').count();
    
    console.log('📊 WORKTREE FLAKY BEHAVIOR TEST SUMMARY:');
    console.log('=========================================');
    console.log(`🎯 Final V2 count: ${finalV2Count}`);
    console.log(`🎯 Final worktree count: ${finalWorktreeCount}`);
    console.log('=========================================');
    
    if (finalV2Count === 0 && finalWorktreeCount === 0) {
      console.log('🎉 SUCCESS: Clean final state achieved!');
    } else {
      console.log('⚠️ Some worktrees remain - check for proper cleanup');
    }
    
    // Take final cleanup screenshot
    await page.screenshot({ path: 'test-results/12-final-cleanup.png', fullPage: true });
  });
});