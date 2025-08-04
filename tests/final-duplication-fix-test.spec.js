import { test, expect } from '@playwright/test';

test.describe('Final Duplication Fix Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('FINAL TEST: Strict isMobile prop check should fix duplication', async ({ page }) => {
    console.log('🎯 FINAL TEST: Testing strict isMobile prop check (=== true) fix');
    
    // STEP 1: Clean and create V3 worktree
    console.log('🧹 Step 1: Setting up V3 worktree...');
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-final-fix-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    await page.waitForTimeout(3000);
    
    // STEP 2: Verify API state
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const v3Count = apiProjects.filter(p => p.displayName === 'agendamente - V3').length;
    console.log(`📊 API V3 projects: ${v3Count}`);
    expect(v3Count).toBe(1);
    
    // STEP 3: Navigate and login
    console.log('🌐 Step 3: Navigating to UI...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 4: Check initial state
    console.log('📊 Step 4: Checking initial state...');
    
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
    
    console.log(`📊 Initial V3 count: ${initialV3Count}`);
    
    // STEP 5: Click on V3 project
    console.log('🖱️ Step 5: Selecting V3 project...');
    
    const v3Elements = await page.locator('text=agendamente - V3').all();
    let clickSuccess = false;
    
    for (const element of v3Elements) {
      if (await element.isVisible()) {
        try {
          await element.click({ timeout: 2000 });
          clickSuccess = true;
          console.log('✅ Successfully clicked V3 project');
          break;
        } catch (e) {
          console.log('⚠️ Click failed, trying next element...');
          continue;
        }
      }
    }
    
    if (!clickSuccess) {
      console.log('❌ Could not click V3 project');
      await page.screenshot({ path: 'test-results/cannot-click-v3.png', fullPage: true });
      // Still continue test
    }
    
    await page.waitForTimeout(2000);
    
    // STEP 6: Send message (critical duplication trigger)
    console.log('💬 Step 6: Sending message (duplication trigger)...');
    
    // Try to find and use new session button first
    const newSessionButton = page.locator('text=New Session').first();
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Find message input
    const messageInput = page.locator('textarea').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('test message to check for duplication');
      
      // Find send button
      const sendButton = page.locator('button[type="submit"]').last();
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await messageInput.press('Enter');
      }
      
      console.log('📤 Message sent, waiting for processing...');
      await page.waitForTimeout(5000);
    } else {
      console.log('⚠️ Could not find message input, continuing test...');
    }
    
    // STEP 7: Check for duplication AFTER message
    console.log('🔍 Step 7: Checking for duplication after message...');
    
    const afterMessageV3Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      const elementDetails = [];
      
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
          
          if (!hasTextChildren) { // Only leaf nodes
            elementDetails.push({
              tagName: element.tagName,
              className: element.className,
              isVisible: isVisible,
              display: computedStyle.display,
              inlineStyle: element.style.cssText
            });
            
            if (isVisible) count++;
          }
        }
      }
      
      // Log element details to console for debugging
      console.log('V3 Elements found:', elementDetails);
      
      return count;
    });
    
    console.log(`📊 V3 count after message: ${afterMessageV3Count}`);
    
    // STEP 8: Multiple checks over time to catch intermittent duplication
    console.log('⏱️ Step 8: Monitoring for intermittent duplication...');
    
    const counts = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);
      
      const currentCount = await page.evaluate(() => {
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
      
      counts.push(currentCount);
      console.log(`📊 Check ${i + 1}: ${currentCount} V3 entries`);
    }
    
    // STEP 9: Test refresh behavior
    console.log('🔄 Step 9: Testing refresh behavior...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Re-login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    const afterRefreshCount = await page.evaluate(() => {
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
    
    console.log(`📊 V3 count after refresh: ${afterRefreshCount}`);
    
    // STEP 10: Final analysis
    console.log('\\n🎯 FINAL DUPLICATION FIX TEST RESULTS:');
    console.log('=====================================');
    console.log(`📊 API V3 projects: ${v3Count}`);
    console.log(`📊 Initial UI V3 count: ${initialV3Count}`);
    console.log(`📊 After message V3 count: ${afterMessageV3Count}`);
    console.log(`📊 Monitoring counts: ${counts.join(', ')}`);
    console.log(`📊 After refresh V3 count: ${afterRefreshCount}`);
    
    const maxCount = Math.max(initialV3Count, afterMessageV3Count, afterRefreshCount, ...counts);
    
    if (maxCount === 1) {
      console.log('\\n🎉 SUCCESS: DUPLICATION COMPLETELY FIXED!');
      console.log('   ✅ All counts show exactly 1 V3 entry');
      console.log('   ✅ No duplication detected at any point');
      console.log('   ✅ Fix is working correctly');
    } else {
      console.log('\\n❌ DUPLICATION STILL EXISTS:');
      console.log(`   Maximum count detected: ${maxCount}`);
      console.log('   Need further investigation');
    }
    
    await page.screenshot({ path: 'test-results/final-fix-test.png', fullPage: true });
    
    // Test assertions
    expect(v3Count).toBe(1);
    expect(maxCount).toBe(1);
    
    console.log('✅ FINAL DUPLICATION FIX TEST COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});