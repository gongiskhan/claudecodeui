import { test, expect } from '@playwright/test';

test.describe('Focused Flaky Behavior Fix', () => {

  test('SETUP AND TEST ALL FLAKY BEHAVIORS', async ({ page }) => {
    console.log('🚀 Starting comprehensive flaky behavior test...');
    
    // Step 1: Ensure server is running and set up authentication
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/flaky-01-initial.png', fullPage: true });
    
    console.log('🔐 Setting up authentication...');
    
    // Check if we need to register or login
    const pageContent = await page.textContent('body');
    const needsAuth = pageContent.includes('Sign in') || pageContent.includes('Username');
    
    let authToken = null;
    
    if (needsAuth) {
      console.log('📝 Authentication required, attempting to login/register...');
      
      // Try to register/login through API first
      try {
        // First try registration
        const registerResponse = await page.request.post('http://localhost:3000/api/auth/register', {
          data: { username: 'ggomes', password: '2WS4rf3ed!' }
        });
        
        if (registerResponse.ok()) {
          const data = await registerResponse.json();
          authToken = data.token;
          console.log('✅ Registration successful');
        } else {
          // Try login
          const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
            data: { username: 'ggomes', password: '2WS4rf3ed!' }
          });
          
          if (loginResponse.ok()) {
            const data = await loginResponse.json();
            authToken = data.token;
            console.log('✅ Login successful');
          }
        }
      } catch (e) {
        console.log('⚠️ API auth failed, trying UI form...');
      }
      
      if (authToken) {
        // Set token and reload
        await page.evaluate((token) => {
          localStorage.setItem('auth-token', token);
        }, authToken);
        await page.reload();
        await page.waitForTimeout(5000);
      } else {
        // Try UI form authentication
        const usernameField = page.locator('input[type="text"], input[name="username"]').first();
        const passwordField = page.locator('input[type="password"], input[name="password"]').first();
        const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")').first();
        
        if (await usernameField.isVisible()) {
          await usernameField.fill('ggomes');
          await passwordField.fill('2WS4rf3ed!');
          await submitButton.click();
          await page.waitForTimeout(5000);
        }
      }
    }
    
    // Take screenshot after auth
    await page.screenshot({ path: 'test-results/flaky-02-after-auth.png', fullPage: true });
    
    // Verify we're authenticated
    const authContent = await page.textContent('body');
    const isAuthenticated = authContent.includes('agendamente') || authContent.includes('New Session');
    
    if (!isAuthenticated) {
      console.log('❌ Authentication failed - cannot proceed with tests');
      expect(isAuthenticated).toBe(true);
      return;
    }
    
    console.log('✅ Authentication successful, proceeding with flaky behavior tests...');
    
    // Step 2: Clean slate - remove any existing worktrees
    console.log('🧹 Cleaning existing worktrees...');
    
    if (authToken) {
      const versions = ['V2', 'V3', 'V4'];
      for (const version of versions) {
        await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    }
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Step 3: TEST FLAKY BEHAVIOR #1 - Duplicate Worktree Creation
    console.log('🔄 TESTING: Duplicate worktree creation via UI...');
    
    // Look for V2 button and click it multiple times rapidly
    const v2Buttons = page.locator('button:has-text("V2"), [data-version="V2"]');
    const v2ButtonCount = await v2Buttons.count();
    
    console.log(`Found ${v2ButtonCount} V2 buttons`);
    
    if (v2ButtonCount > 0) {
      const v2Button = v2Buttons.first();
      
      // Click rapidly 5 times
      console.log('🖱️ Clicking V2 button rapidly 5 times...');
      for (let i = 0; i < 5; i++) {
        if (await v2Button.isVisible()) {
          await v2Button.click();
          await page.waitForTimeout(200);
        }
      }
      
      await page.waitForTimeout(3000);
      
      // Count V2 worktrees created
      const v2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 V2 worktrees after rapid clicking: ${v2Count}`);
      
      if (v2Count > 1) {
        console.log('🚨 FLAKY BEHAVIOR #1 CONFIRMED: Multiple V2 worktrees created');
      } else {
        console.log('✅ FLAKY BEHAVIOR #1 FIXED: Only one V2 worktree created');
      }
      
      await page.screenshot({ path: 'test-results/flaky-03-after-rapid-clicks.png', fullPage: true });
    }
    
    // Step 4: TEST FLAKY BEHAVIOR #2 - State Changes After Refresh
    console.log('🔄 TESTING: State consistency after refresh...');
    
    const beforeRefreshV2 = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count before refresh: ${beforeRefreshV2}`);
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    const afterRefreshV2 = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count after refresh: ${afterRefreshV2}`);
    
    if (beforeRefreshV2 !== afterRefreshV2) {
      console.log('🚨 FLAKY BEHAVIOR #2 CONFIRMED: State changed after refresh');
      console.log(`  Before: ${beforeRefreshV2}, After: ${afterRefreshV2}`);
    } else {
      console.log('✅ FLAKY BEHAVIOR #2 FIXED: State consistent after refresh');
    }
    
    await page.screenshot({ path: 'test-results/flaky-04-after-refresh.png', fullPage: true });
    
    // Step 5: TEST FLAKY BEHAVIOR #3 - Worktree Disappears During Message
    console.log('💬 TESTING: Worktree behavior during message sending...');
    
    // Ensure we have exactly one V2 worktree
    if (authToken) {
      await page.request.delete('http://localhost:3000/api/worktree/V2', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
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
    }
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Find and click V2 worktree
    const v2Project = page.locator('text=agendamente - V2').first();
    
    if (await v2Project.isVisible()) {
      console.log('📂 Selecting V2 worktree for message test...');
      await v2Project.click();
      await page.waitForTimeout(2000);
      
      // Look for message input
      const messageInput = page.locator('textarea, input[type="text"]').last();
      
      if (await messageInput.isVisible()) {
        console.log('💬 Found message input, testing for disappearing behavior...');
        
        // Monitor worktree visibility
        const beforeMessage = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 worktrees before message: ${beforeMessage}`);
        
        // Type and send message
        await messageInput.fill('Test message to check for worktree disappearing');
        
        // Monitor during typing
        const duringTyping = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 worktrees during typing: ${duringTyping}`);
        
        await messageInput.press('Enter');
        
        // Monitor during message processing
        await page.waitForTimeout(1000);
        const duringProcessing = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 worktrees during processing: ${duringProcessing}`);
        
        await page.waitForTimeout(5000);
        const afterMessage = await page.locator('text=agendamente - V2').count();
        console.log(`📊 V2 worktrees after message: ${afterMessage}`);
        
        if (duringProcessing !== beforeMessage || afterMessage !== beforeMessage) {
          console.log('🚨 FLAKY BEHAVIOR #3 CONFIRMED: Worktree disappeared during message');
        } else {
          console.log('✅ FLAKY BEHAVIOR #3 FIXED: Worktree stable during message');
        }
        
        await page.screenshot({ path: 'test-results/flaky-05-message-test.png', fullPage: true });
      }
    }
    
    // Step 6: TEST FLAKY BEHAVIOR #4 - Sessions Disappear After Refresh
    console.log('💾 TESTING: Session persistence after refresh...');
    
    // Look for any sessions
    const beforeSessions = await page.locator('text=lopoo, text=Just now, .session-item').count();
    console.log(`📊 Sessions before refresh: ${beforeSessions}`);
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    const afterSessions = await page.locator('text=lopoo, text=Just now, .session-item').count();
    console.log(`📊 Sessions after refresh: ${afterSessions}`);
    
    if (beforeSessions > 0 && afterSessions === 0) {
      console.log('🚨 FLAKY BEHAVIOR #4 CONFIRMED: Sessions disappeared after refresh');
    } else {
      console.log('✅ FLAKY BEHAVIOR #4 STATUS: Sessions behavior stable');
    }
    
    await page.screenshot({ path: 'test-results/flaky-06-session-test.png', fullPage: true });
    
    // Step 7: COMPREHENSIVE ANALYSIS
    console.log('🔍 COMPREHENSIVE FLAKY BEHAVIOR ANALYSIS...');
    
    // API vs UI state check
    if (authToken) {
      const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (apiResponse.ok()) {
        const apiProjects = await apiResponse.json();
        const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
        const uiV2Count = await page.locator('text=agendamente - V2').count();
        
        console.log('📊 FINAL STATE ANALYSIS:');
        console.log('========================');
        console.log(`API V2 Count: ${apiV2Count}`);
        console.log(`UI V2 Count: ${uiV2Count}`);
        console.log(`State Consistent: ${apiV2Count === uiV2Count}`);
        
        if (apiV2Count !== uiV2Count) {
          console.log('🚨 ROOT CAUSE: API and UI state synchronization issue');
          console.log('   This is likely the source of all flaky behavior!');
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/flaky-07-final-analysis.png', fullPage: true });
    
    console.log('✅ Comprehensive flaky behavior test completed');
    console.log('📸 Screenshots saved to test-results/ folder for analysis');
  });
});