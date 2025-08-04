import { test, expect } from '@playwright/test';

test.describe('Message Send Duplication Bug', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('REPRODUCE: Duplication after sending message to worktree', async ({ page }) => {
    console.log('🎯 REPRODUCING: Duplication bug after sending message to worktree');
    
    // STEP 1: Clean slate - remove all worktrees
    console.log('🧹 Step 1: Cleaning all worktrees...');
    const versions = ['V2', 'V3', 'V4', 'V5'];
    for (const version of versions) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    await page.waitForTimeout(2000);
    
    // STEP 2: Create V3 worktree (like in user's screenshot)
    console.log('🏗️ Step 2: Creating V3 worktree...');
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-message-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    await page.waitForTimeout(3000);
    
    // STEP 3: Verify API has exactly 1 V3 project
    console.log('📊 Step 3: Verifying API state before message...');
    const apiResponseBefore = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjectsBefore = await apiResponseBefore.json();
    const v3CountBefore = apiProjectsBefore.filter(p => p.displayName === 'agendamente - V3').length;
    console.log(`📋 API V3 projects before message: ${v3CountBefore}`);
    expect(v3CountBefore).toBe(1);
    
    // STEP 4: Navigate to UI and login
    console.log('🌐 Step 4: Navigating to UI...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 5: Select V3 worktree
    console.log('📁 Step 5: Selecting V3 worktree...');
    const v3Project = page.locator('text=agendamente - V3').first();
    await v3Project.click();
    await page.waitForTimeout(2000);
    
    // Check initial V3 count in UI
    const initialV3Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const isVisible = (
            element.offsetParent !== null &&
            computedStyle.visibility !== 'hidden' &&
            computedStyle.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          if (isVisible && !hasTextChildren) count++;
        }
      }
      return count;
    });
    
    console.log(`📊 Initial V3 count in UI: ${initialV3Count}`);
    
    // STEP 6: Create new session in V3 worktree
    console.log('➕ Step 6: Creating new session in V3...');
    const newSessionButton = page.locator('text=New Session').first();
    await newSessionButton.click();
    await page.waitForTimeout(3000);
    
    // STEP 7: Send a message (this is where the bug happens!)
    console.log('💬 Step 7: Sending message to V3 worktree (BUG TRIGGER)...');
    
    // Find the message input and send button
    const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"], textarea').first();
    const sendButton = page.locator('button:has-text("Send"), button[type="submit"]').last();
    
    if (await messageInput.isVisible()) {
      await messageInput.fill('test message that triggers duplication bug');
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        // Try pressing Enter if no send button
        await messageInput.press('Enter');
      }
      await page.waitForTimeout(5000); // Wait for message processing and WebSocket updates
    } else {
      console.log('⚠️ Could not find message input - UI might be different');
      // Take screenshot to see current state
      await page.screenshot({ path: 'test-results/message-input-not-found.png', fullPage: true });
    }
    
    // STEP 8: Check for duplication AFTER sending message
    console.log('🔍 Step 8: Checking for duplication after message...');
    
    const afterMessageV3Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const isVisible = (
            element.offsetParent !== null &&
            computedStyle.visibility !== 'hidden' &&
            computedStyle.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          if (isVisible && !hasTextChildren) count++;
        }
      }
      return count;
    });
    
    console.log(`📊 V3 count after message: ${afterMessageV3Count}`);
    
    // STEP 9: Check API state after message
    const apiResponseAfter = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjectsAfter = await apiResponseAfter.json();
    const v3CountAfter = apiProjectsAfter.filter(p => p.displayName === 'agendamente - V3').length;
    console.log(`📋 API V3 projects after message: ${v3CountAfter}`);
    
    // STEP 10: Take screenshot showing duplication
    await page.screenshot({ path: 'test-results/duplication-after-message.png', fullPage: true });
    
    // STEP 11: Test refresh behavior (user's second complaint)
    console.log('🔄 Step 11: Testing refresh behavior...');
    
    // Get current session info before refresh
    const sessionInfoBefore = await page.evaluate(() => {
      // Look for session indicators
      const sessionElements = document.querySelectorAll('[class*="session"], [class*="message"]');
      return {
        hasActiveSession: sessionElements.length > 0,
        sessionCount: sessionElements.length,
        currentUrl: window.location.href
      };
    });
    
    console.log(`📋 Session info before refresh: ${JSON.stringify(sessionInfoBefore)}`);
    
    // Refresh the page
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Re-login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // Check V3 count after refresh
    const afterRefreshV3Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const isVisible = (
            element.offsetParent !== null &&
            computedStyle.visibility !== 'hidden' &&
            computedStyle.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          if (isVisible && !hasTextChildren) count++;
        }
      }
      return count;
    });
    
    // Check session after refresh
    const sessionInfoAfter = await page.evaluate(() => {
      const sessionElements = document.querySelectorAll('[class*="session"], [class*="message"]');
      return {
        hasActiveSession: sessionElements.length > 0,
        sessionCount: sessionElements.length,
        currentUrl: window.location.href
      };
    });
    
    console.log(`📊 V3 count after refresh: ${afterRefreshV3Count}`);
    console.log(`📋 Session info after refresh: ${JSON.stringify(sessionInfoAfter)}`);
    
    // STEP 12: Final analysis
    console.log('\\n🎯 BUG REPRODUCTION RESULTS:');
    console.log('============================');
    console.log(`📊 API V3 count before message: ${v3CountBefore}`);
    console.log(`📊 API V3 count after message: ${v3CountAfter}`);
    console.log(`📊 UI V3 count before message: ${initialV3Count}`);
    console.log(`📊 UI V3 count after message: ${afterMessageV3Count}`);
    console.log(`📊 UI V3 count after refresh: ${afterRefreshV3Count}`);
    console.log(`📋 Session before refresh: ${sessionInfoBefore.hasActiveSession}`);
    console.log(`📋 Session after refresh: ${sessionInfoAfter.hasActiveSession}`);
    
    // Analyze the bugs
    if (afterMessageV3Count > 1) {
      console.log('🚨 BUG CONFIRMED: Message sending causes UI duplication');
    } else {
      console.log('✅ Message sending duplication: Not reproduced');
    }
    
    if (afterRefreshV3Count === 1 && !sessionInfoAfter.hasActiveSession && sessionInfoBefore.hasActiveSession) {
      console.log('🚨 BUG CONFIRMED: Refresh removes duplicates but loses session');
    } else {
      console.log('✅ Refresh behavior: Working correctly');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/final-state-after-refresh.png', fullPage: true });
    
    console.log('✅ BUG REPRODUCTION TEST COMPLETE');
    
    // Clean up
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});