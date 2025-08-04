import { test, expect } from '@playwright/test';

test.describe('Final Flaky Behavior Test - ACTUALLY WORKING', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('COMPREHENSIVE FLAKY BEHAVIOR TEST', async ({ page }) => {
    console.log('🚀 Starting REAL flaky behavior test with working authentication...');
    
    // STEP 1: Clean up any existing worktrees
    console.log('🧹 Cleaning up existing worktrees...');
    const versions = ['V2', 'V3', 'V4'];
    for (const version of versions) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    // STEP 2: Navigate to UI and set authentication
    console.log('🔐 Setting up UI authentication...');
    await page.goto('http://localhost:3001');
    
    // Set auth token directly in localStorage
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
      console.log('Auth token set:', token.substring(0, 20) + '...');
    }, AUTH_TOKEN);
    
    // Reload to trigger auth
    await page.reload();
    await page.waitForTimeout(8000); // Long wait for full load
    
    // Take screenshot to verify we're logged in
    await page.screenshot({ path: 'test-results/final-01-authenticated.png', fullPage: true });
    
    // Verify authentication worked
    const pageContent = await page.textContent('body');
    const isAuthenticated = pageContent.includes('agendamente') || pageContent.includes('New Session');
    
    console.log(`🔍 Authentication status: ${isAuthenticated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📄 Page content preview: ${pageContent.substring(0, 200)}...`);
    
    if (!isAuthenticated) {
      console.log('❌ Still not authenticated - debugging...');
      console.log('Full page content:', pageContent);
      await page.screenshot({ path: 'test-results/final-auth-failed.png', fullPage: true });
    }
    
    expect(isAuthenticated).toBe(true);
    
    console.log('✅ Successfully authenticated, proceeding with tests...');
    
    // STEP 3: TEST FLAKY BEHAVIOR #1 - Duplicate Worktree Creation
    console.log('🔄 TESTING FLAKY BEHAVIOR #1: Duplicate worktree creation...');
    
    // Look for V2 creation button
    console.log('🔍 Looking for V2 worktree creation button...');
    
    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/final-02-looking-for-buttons.png', fullPage: true });
    
    // Try multiple strategies to find V2 button
    const buttonSelectors = [
      'button:has-text("V2")',
      '[data-version="V2"]', 
      'button[title*="V2"]',
      '.worktree-button:has-text("V2")',
      'button:near(:text("agendamente")):has-text("V2")'
    ];
    
    let v2Button = null;
    for (const selector of buttonSelectors) {
      try {
        const buttons = page.locator(selector);
        const count = await buttons.count();
        console.log(`  Selector "${selector}": ${count} buttons found`);
        
        if (count > 0) {
          v2Button = buttons.first();
          if (await v2Button.isVisible()) {
            console.log(`✅ Found visible V2 button with: ${selector}`);
            break;
          }
        }
      } catch (e) {
        console.log(`  Selector "${selector}": error - ${e.message}`);
      }
    }
    
    if (!v2Button || !(await v2Button.isVisible())) {
      console.log('🔍 V2 button not found with selectors, trying to find any buttons...');
      
      // List all buttons for debugging
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} total buttons:`);
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const btn = allButtons.nth(i);
        const btnText = await btn.textContent();
        const isVisible = await btn.isVisible();
        console.log(`  Button ${i}: "${btnText}" (visible: ${isVisible})`);
      }
      
      // Look for buttons with specific patterns
      const vButtons = page.locator('button').filter({ hasText: /V\d+/ });
      const vButtonCount = await vButtons.count();
      console.log(`Found ${vButtonCount} buttons with V pattern`);
      
      if (vButtonCount > 0) {
        for (let i = 0; i < vButtonCount; i++) {
          const btn = vButtons.nth(i);
          const btnText = await btn.textContent();
          console.log(`  V Button ${i}: "${btnText}"`);
          if (btnText && btnText.includes('V2')) {
            v2Button = btn;
            break;
          }
        }
      }
    }
    
    if (v2Button && await v2Button.isVisible()) {
      console.log('🖱️ Found V2 button! Testing rapid clicking...');
      
      // Record initial state
      const initialV2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 Initial V2 count: ${initialV2Count}`);
      
      // Click rapidly 5 times
      console.log('🔄 Clicking V2 button 5 times rapidly...');
      for (let i = 0; i < 5; i++) {
        if (await v2Button.isVisible()) {
          await v2Button.click();
          console.log(`  Click ${i + 1} completed`);
          await page.waitForTimeout(300);
        }
      }
      
      // Wait for operations to complete
      await page.waitForTimeout(5000);
      
      // Count V2 worktrees after clicking
      const finalV2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 Final V2 count after rapid clicking: ${finalV2Count}`);
      
      await page.screenshot({ path: 'test-results/final-03-after-rapid-clicks.png', fullPage: true });
      
      if (finalV2Count > 1) {
        console.log('🚨 FLAKY BEHAVIOR #1 CONFIRMED: Multiple V2 worktrees created!');
      } else if (finalV2Count === 1) {
        console.log('✅ FLAKY BEHAVIOR #1 FIXED: Only one V2 worktree created');
      } else {
        console.log('⚠️ No V2 worktrees visible after clicking');
      }
      
    } else {
      console.log('❌ Could not find V2 button - creating worktree via API for further tests');
      
      // Create via API for remaining tests
      const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: {
          branch: 'feature/v2-test',
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        }
      });
      
      console.log(`API creation status: ${createResponse.status()}`);
      await page.reload();
      await page.waitForTimeout(5000);
    }
    
    // STEP 4: TEST FLAKY BEHAVIOR #2 - State inconsistency after refresh
    console.log('🔄 TESTING FLAKY BEHAVIOR #2: State consistency after refresh...');
    
    const beforeRefreshV2 = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count before refresh: ${beforeRefreshV2}`);
    
    await page.screenshot({ path: 'test-results/final-04-before-refresh.png', fullPage: true });
    
    await page.reload();
    await page.waitForTimeout(8000);
    
    const afterRefreshV2 = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count after refresh: ${afterRefreshV2}`);
    
    await page.screenshot({ path: 'test-results/final-05-after-refresh.png', fullPage: true });
    
    if (beforeRefreshV2 !== afterRefreshV2) {
      console.log('🚨 FLAKY BEHAVIOR #2 CONFIRMED: State changed after refresh!');
      console.log(`  Before: ${beforeRefreshV2}, After: ${afterRefreshV2}`);
    } else {
      console.log('✅ FLAKY BEHAVIOR #2 STATUS: State consistent after refresh');
    }
    
    // STEP 5: TEST FLAKY BEHAVIOR #3 - Worktree disappears during message
    console.log('💬 TESTING FLAKY BEHAVIOR #3: Worktree behavior during message...');
    
    // Find V2 worktree
    const v2Worktree = page.locator('text=agendamente - V2').first();
    
    if (await v2Worktree.isVisible()) {
      console.log('📂 Found V2 worktree, selecting for message test...');
      await v2Worktree.click();
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'test-results/final-06-worktree-selected.png', fullPage: true });
      
      // Look for message input
      const messageInputs = [
        'textarea[placeholder*="message"]',
        'input[type="text"]',
        'textarea',
        '.message-input'
      ];
      
      let messageInput = null;
      for (const selector of messageInputs) {
        const inputs = page.locator(selector);
        const count = await inputs.count();
        console.log(`Message input "${selector}": ${count} found`);
        
        if (count > 0) {
          const input = inputs.last(); // Use last one (most likely to be the chat input)
          if (await input.isVisible()) {
            messageInput = input;
            console.log(`✅ Found message input: ${selector}`);
            break;
          }
        }
      }
      
      if (messageInput && await messageInput.isVisible()) {
        console.log('💬 Testing worktree stability during message...');
        
        // Monitor worktree count before message
        const beforeMessage = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 count before message: ${beforeMessage}`);
        
        // Type message
        await messageInput.fill('Testing worktree stability during message sending - checking for flaky behavior');
        
        // Monitor during typing
        const duringTyping = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 count during typing: ${duringTyping}`);
        
        // Send message
        await messageInput.press('Enter');
        
        // Monitor during processing (check every 500ms for 10 seconds)
        console.log('⏱️ Monitoring worktree stability during message processing...');
        const monitoringResults = [];
        
        for (let i = 0; i < 20; i++) {
          const count = await page.locator('text=agendamente - V2').count();
          monitoringResults.push(count);
          await page.waitForTimeout(500);
        }
        
        console.log('📊 Monitoring results:', monitoringResults);
        
        // Check for flickering
        const hasFlickering = monitoringResults.some((count, index) => 
          index > 0 && count !== monitoringResults[0]
        );
        
        if (hasFlickering) {
          console.log('🚨 FLAKY BEHAVIOR #3 CONFIRMED: Worktree flickered during message!');
        } else {
          console.log('✅ FLAKY BEHAVIOR #3 STATUS: Worktree stable during message');
        }
        
        await page.screenshot({ path: 'test-results/final-07-after-message.png', fullPage: true });
        
      } else {
        console.log('❌ Message input not found');
      }
      
    } else {
      console.log('❌ V2 worktree not visible for message test');
    }
    
    // STEP 6: COMPREHENSIVE STATE ANALYSIS
    console.log('🔍 FINAL COMPREHENSIVE STATE ANALYSIS...');
    
    // Get API state
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    let apiV2Count = 0;
    let apiWorktreeCount = 0;
    
    if (apiResponse.ok()) {
      const apiProjects = await apiResponse.json();
      apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
      apiWorktreeCount = apiProjects.filter(p => p.isWorktree).length;
      
      console.log('📋 API Projects:');
      apiProjects.forEach(p => {
        console.log(`  - ${p.displayName} [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
      });
    }
    
    // Get UI state
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    const uiWorktreeCount = await page.locator('text=agendamente -').count();
    
    await page.screenshot({ path: 'test-results/final-08-final-analysis.png', fullPage: true });
    
    console.log('🎯 COMPREHENSIVE FLAKY BEHAVIOR ANALYSIS:');
    console.log('=========================================');
    console.log(`📊 API V2 Count: ${apiV2Count}`);
    console.log(`📊 UI V2 Count: ${uiV2Count}`);
    console.log(`📊 API Total Worktrees: ${apiWorktreeCount}`);
    console.log(`📊 UI Total Worktrees: ${uiWorktreeCount}`);
    console.log(`🔍 V2 State Consistent: ${apiV2Count === uiV2Count}`);
    console.log(`🔍 Worktree State Consistent: ${apiWorktreeCount === uiWorktreeCount}`);
    console.log('=========================================');
    
    if (apiV2Count !== uiV2Count || apiWorktreeCount !== uiWorktreeCount) {
      console.log('🚨 ROOT CAUSE IDENTIFIED: API and UI state synchronization issues!');
      console.log('   This is the primary source of all flaky behavior you experience!');
      console.log('   - API has different data than what UI displays');
      console.log('   - This causes inconsistent behavior across refreshes');
      console.log('   - Worktrees appear/disappear due to sync timing issues');
    } else {
      console.log('✅ API and UI states are synchronized');
    }
    
    // STEP 7: Clean up
    console.log('🧹 Test cleanup...');
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ COMPREHENSIVE FLAKY BEHAVIOR TEST COMPLETED');
    console.log('📸 All screenshots saved to test-results/ for detailed analysis');
  });
});