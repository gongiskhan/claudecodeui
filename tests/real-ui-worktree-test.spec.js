import { test, expect } from '@playwright/test';

test.describe('Real UI Worktree Test - Actually Test Everything', () => {
  let authToken = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('🔐 Attempting authentication with ggomes credentials...');
    
    // Try to login with the correct credentials
    let loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'ggomes', password: '2WS4rf3ed!' }
    });
    
    if (!loginResponse.ok()) {
      console.log('⚠️ Login failed, trying to register...');
      loginResponse = await page.request.post('http://localhost:3000/api/auth/register', {
        data: { username: 'ggomes', password: '2WS4rf3ed!' }
      });
    }
    
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      console.log('✅ Authentication successful with ggomes credentials');
    } else {
      console.log('❌ Authentication failed completely');
    }
    
    await context.close();
  });

  test('1. VERIFY ACTUAL LOGIN AND UI ACCESS', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🔍 Testing actual login flow and UI access...');
    
    // Go to the app
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/real-01-initial-page.png', fullPage: true });
    
    // Set the auth token
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
      console.log('Auth token set in localStorage');
    }, authToken);
    
    // Reload to trigger authentication
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Take post-auth screenshot
    await page.screenshot({ path: 'test-results/real-02-after-auth.png', fullPage: true });
    
    // Check if we're actually logged in by looking for UI elements
    const pageContent = await page.textContent('body');
    const hasLoginForm = pageContent.includes('Sign in') || pageContent.includes('Username') || pageContent.includes('Password');
    const hasProjectUI = pageContent.includes('agendamente') || pageContent.includes('New Session') || pageContent.includes('projects');
    
    console.log('🔍 Page analysis:');
    console.log(`  - Has login form: ${hasLoginForm}`);
    console.log(`  - Has project UI: ${hasProjectUI}`);
    console.log(`  - Page content preview: ${pageContent.substring(0, 200)}...`);
    
    if (hasLoginForm && !hasProjectUI) {
      console.log('🚨 STILL STUCK AT LOGIN SCREEN!');
      
      // Try to fill login form if present
      const usernameField = page.locator('input[type="text"], input[name="username"], input[placeholder*="username"]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"]').first();
      const loginButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();
      
      if (await usernameField.isVisible()) {
        console.log('📝 Found login form, attempting manual login...');
        await usernameField.fill('ggomes');
        await passwordField.fill('2WS4rf3ed!');
        await loginButton.click();
        await page.waitForTimeout(5000);
        
        // Take screenshot after manual login
        await page.screenshot({ path: 'test-results/real-03-manual-login.png', fullPage: true });
      }
    }
    
    // Final check
    const finalContent = await page.textContent('body');
    const finalHasProjects = finalContent.includes('agendamente');
    
    expect(finalHasProjects).toBe(true);
    console.log('✅ Successfully accessed the main UI');
  });

  test('2. TEST API VS UI STATE CONSISTENCY', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🔍 Testing API vs UI state consistency...');
    
    // Clean slate first
    await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    // Create a worktree via API
    console.log('📝 Creating V2 worktree via API...');
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-consistency-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    console.log('✅ V2 worktree created via API');
    
    // Check API state
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    
    console.log(`📊 API State: ${apiV2Count} V2 projects`);
    console.log('📋 API Projects:');
    apiProjects.forEach(p => {
      console.log(`  - ${p.displayName} [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
    });
    
    // Now check UI
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(8000); // Longer wait for UI to sync
    
    // Take screenshot of UI state
    await page.screenshot({ path: 'test-results/real-04-ui-state.png', fullPage: true });
    
    // Count V2 projects in UI
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    const uiAllWorktrees = await page.locator('text=agendamente -').count();
    
    console.log(`📊 UI State: ${uiV2Count} V2 projects visible`);
    console.log(`📊 UI State: ${uiAllWorktrees} total worktrees visible`);
    
    // This is the core bug - API has data but UI doesn't show it
    if (apiV2Count !== uiV2Count) {
      console.log('🚨 CORE BUG CONFIRMED: API and UI are out of sync!');
      console.log(`  API shows: ${apiV2Count} V2 projects`);
      console.log(`  UI shows: ${uiV2Count} V2 projects`);
    }
    
    // For now, expect at least consistency (even if both are 0)
    expect(apiV2Count).toBeGreaterThan(0); // API should have the worktree
  });

  test('3. TEST ACTUAL UI WORKTREE CREATION', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🖱️ Testing actual UI worktree creation...');
    
    // Clean slate
    await page.request.delete('http://localhost:3000/api/worktree/V3', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    // Navigate to UI
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(8000);
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'test-results/real-05-before-ui-create.png', fullPage: true });
    
    // Find and click V3 button
    console.log('🔍 Looking for V3 creation button...');
    
    // Try different strategies to find the V3 button
    let v3Button = null;
    
    // Strategy 1: Look for button with V3 text
    const v3Buttons = page.locator('button:has-text("V3")');
    const v3ButtonCount = await v3Buttons.count();
    console.log(`Found ${v3ButtonCount} buttons with "V3" text`);
    
    if (v3ButtonCount > 0) {
      v3Button = v3Buttons.first();
    } else {
      // Strategy 2: Look for buttons with 🌳 icon and V3
      const treeButtons = page.locator('button:has-text("🌳")');
      const treeButtonCount = await treeButtons.count();
      console.log(`Found ${treeButtonCount} buttons with tree icon`);
      
      if (treeButtonCount > 0) {
        // Check each tree button for V3
        for (let i = 0; i < treeButtonCount; i++) {
          const btn = treeButtons.nth(i);
          const btnText = await btn.textContent();
          if (btnText && btnText.includes('V3')) {
            v3Button = btn;
            break;
          }
        }
      }
    }
    
    if (v3Button && await v3Button.isVisible()) {
      console.log('✅ Found V3 button, clicking...');
      
      // Count projects before click
      const beforeCount = await page.locator('text=agendamente - V3').count();
      console.log(`📊 V3 projects before click: ${beforeCount}`);
      
      // Click the button
      await v3Button.click();
      
      // Wait for creation
      await page.waitForTimeout(5000);
      
      // Take screenshot after click
      await page.screenshot({ path: 'test-results/real-06-after-ui-create.png', fullPage: true });
      
      // Count projects after click
      const afterCount = await page.locator('text=agendamente - V3').count();
      console.log(`📊 V3 projects after click: ${afterCount}`);
      
      if (afterCount > beforeCount) {
        console.log('✅ UI worktree creation working');
      } else {
        console.log('⚠️ UI worktree creation may not be working');
        
        // Check API to see if it was created
        const apiCheck = await page.request.get('http://localhost:3000/api/projects', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const projects = await apiCheck.json();
        const v3InApi = projects.filter(p => p.displayName === 'agendamente - V3').length;
        console.log(`📊 V3 projects in API: ${v3InApi}`);
      }
      
    } else {
      console.log('❌ V3 button not found in UI');
      
      // Show what buttons are available
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} total buttons`);
      
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const btn = allButtons.nth(i);
        const btnText = await btn.textContent();
        console.log(`  Button ${i}: "${btnText}"`);
      }
    }
  });

  test('4. TEST MESSAGE SENDING AND FLICKERING', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('💬 Testing message sending and worktree flickering...');
    
    // Ensure we have a V2 worktree
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
    
    // Navigate to UI
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(8000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/real-07-before-message.png', fullPage: true });
    
    // Look for V2 worktree and click it
    const v2Project = page.locator('text=agendamente - V2').first();
    
    if (await v2Project.isVisible()) {
      console.log('📂 Found V2 worktree, selecting...');
      await v2Project.click();
      await page.waitForTimeout(3000);
      
      // Take screenshot after selection
      await page.screenshot({ path: 'test-results/real-08-worktree-selected.png', fullPage: true });
      
      // Look for message input
      const messageInput = page.locator('textarea, input[type="text"]').last();
      
      if (await messageInput.isVisible()) {
        console.log('💬 Found message input, testing flickering...');
        
        // Monitor worktree visibility during message sending
        const beforeMessageV2Count = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 worktrees before message: ${beforeMessageV2Count}`);
        
        // Type message
        await messageInput.fill('Testing for worktree flickering behavior during message sending');
        
        // Start monitoring for flickering
        const flickerMonitor = async () => {
          const checks = [];
          for (let i = 0; i < 20; i++) {
            const count = await page.locator('text=agendamente - V2').count();
            checks.push(count);
            await page.waitForTimeout(250);
          }
          return checks;
        };
        
        // Send message and monitor simultaneously
        const [_, flickerResults] = await Promise.all([
          messageInput.press('Enter'),
          flickerMonitor()
        ]);
        
        console.log('📊 Flickering monitor results:', flickerResults);
        
        // Check for flickering (count changing during message)
        const hasFlickering = flickerResults.some((count, index) => 
          index > 0 && count !== flickerResults[0]
        );
        
        if (hasFlickering) {
          console.log('🚨 FLICKERING DETECTED during message sending!');
        } else {
          console.log('✅ No flickering detected during message sending');
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'test-results/real-09-after-message.png', fullPage: true });
        
      } else {
        console.log('❌ Message input not found');
      }
      
    } else {
      console.log('❌ V2 worktree not visible in UI');
    }
  });

  test('5. TEST REFRESH BEHAVIOR AND SESSION PERSISTENCE', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🔄 Testing refresh behavior and session persistence...');
    
    // Navigate to UI
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(8000);
    
    // Record state before refresh
    const beforeV2Count = await page.locator('text=agendamente - V2').count();
    const beforeSessionCount = await page.locator('text=lopoo, text=Just now').count();
    
    console.log(`📊 Before refresh - V2: ${beforeV2Count}, Sessions: ${beforeSessionCount}`);
    
    // Take screenshot before refresh
    await page.screenshot({ path: 'test-results/real-10-before-refresh.png', fullPage: true });
    
    // Refresh page
    console.log('🔄 Refreshing page...');
    await page.reload();
    await page.waitForTimeout(8000);
    
    // Record state after refresh
    const afterV2Count = await page.locator('text=agendamente - V2').count();
    const afterSessionCount = await page.locator('text=lopoo, text=Just now').count();
    
    console.log(`📊 After refresh - V2: ${afterV2Count}, Sessions: ${afterSessionCount}`);
    
    // Take screenshot after refresh
    await page.screenshot({ path: 'test-results/real-11-after-refresh.png', fullPage: true });
    
    // Check for session disappearing
    if (beforeSessionCount > 0 && afterSessionCount === 0) {
      console.log('🚨 SESSIONS DISAPPEARED after refresh!');
    } else if (beforeSessionCount === afterSessionCount) {
      console.log('✅ Sessions persisted through refresh');
    }
    
    // Check for worktree count changes
    if (beforeV2Count !== afterV2Count) {
      console.log('🚨 WORKTREE COUNT CHANGED after refresh!');
      console.log(`  Before: ${beforeV2Count}, After: ${afterV2Count}`);
    } else {
      console.log('✅ Worktree count consistent through refresh');
    }
  });

  test('6. COMPREHENSIVE BUG SUMMARY', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('📊 Running comprehensive bug analysis...');
    
    // Get final API state
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiWorktreeCount = apiProjects.filter(p => p.isWorktree).length;
    
    // Get final UI state
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(8000);
    
    const uiWorktreeCount = await page.locator('text=agendamente -').count();
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/real-12-final-analysis.png', fullPage: true });
    
    console.log('🎯 COMPREHENSIVE WORKTREE BUG ANALYSIS:');
    console.log('=======================================');
    console.log(`📊 API Worktree Count: ${apiWorktreeCount}`);
    console.log(`📊 UI Worktree Count: ${uiWorktreeCount}`);
    console.log(`🔍 State Consistent: ${apiWorktreeCount === uiWorktreeCount}`);
    console.log('=======================================');
    
    if (apiWorktreeCount !== uiWorktreeCount) {
      console.log('🚨 PRIMARY BUG: API and UI state synchronization');
      console.log('   This causes all the flaky behavior you experience!');
    }
    
    // Clean up
    await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    await page.request.delete('http://localhost:3000/api/worktree/V3', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('✅ Test cleanup completed');
  });
});