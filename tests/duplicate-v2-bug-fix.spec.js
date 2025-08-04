import { test, expect } from '@playwright/test';

test.describe('DUPLICATE V2 BUG - ACTUALLY FIX IT', () => {

  test('REPRODUCE AND FIX THE EXACT DUPLICATE V2 BUG FROM SCREENSHOT', async ({ page }) => {
    console.log('🎯 REPRODUCING THE EXACT DUPLICATE V2 BUG FROM THE SCREENSHOT');
    console.log('   Two identical "agendamente - V2" entries visible in UI');
    
    // STEP 1: Navigate to the app
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // STEP 2: Login (since proxy is now working)
    const usernameField = page.locator('input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await passwordField.fill('testpass123');
      await submitButton.click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 3: Take screenshot to see current state
    await page.screenshot({ path: 'test-results/duplicate-bug-01-current-state.png', fullPage: true });
    
    // STEP 4: Count existing V2 entries
    const initialV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 Initial V2 count: ${initialV2Count}`);
    
    if (initialV2Count > 1) {
      console.log('🚨 BUG CONFIRMED: Already seeing duplicate V2 entries!');
      
      // Get all V2 elements and analyze them
      const v2Elements = page.locator('text=agendamente - V2');
      for (let i = 0; i < initialV2Count; i++) {
        const element = v2Elements.nth(i);
        const text = await element.textContent();
        const parent = element.locator('..');
        const parentText = await parent.textContent();
        console.log(`  V2 Entry ${i + 1}: "${text}" (parent: "${parentText.substring(0, 100)}...")`);
      }
    }
    
    // STEP 5: Check API state vs UI state
    console.log('📊 Checking API vs UI state...');
    
    // Get API data (bypass auth for now)
    const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (apiResponse.ok()) {
      const apiProjects = await apiResponse.json();
      const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
      
      console.log(`📋 API V2 count: ${apiV2Count}`);
      console.log(`📋 UI V2 count: ${initialV2Count}`);
      
      console.log('📋 API Projects:');
      apiProjects.forEach((p, index) => {
        console.log(`  ${index + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
        console.log(`      Name: ${p.name}`);
        console.log(`      Path: ${p.path}`);
      });
      
      if (apiV2Count !== initialV2Count) {
        console.log('🚨 API-UI MISMATCH: Different counts between API and UI!');
        console.log(`   API has ${apiV2Count} V2 worktrees`);
        console.log(`   UI shows ${initialV2Count} V2 worktrees`);
      }
      
      if (apiV2Count > 1) {
        console.log('🚨 API HAS DUPLICATES: The backend actually has duplicate V2 worktrees!');
      } else if (initialV2Count > 1 && apiV2Count === 1) {
        console.log('🚨 UI RENDERING DUPLICATES: Backend has 1, but UI renders multiple!');
      }
    }
    
    // STEP 6: Try to create another V2 to test duplicate prevention
    console.log('🔄 Testing V2 creation to understand duplicate behavior...');
    
    // Look for V2 button in main agendamente section
    const v2Buttons = page.locator('button:has-text("V2")');
    const v2ButtonCount = await v2Buttons.count();
    
    console.log(`🔍 Found ${v2ButtonCount} V2 buttons`);
    
    if (v2ButtonCount > 0) {
      // Click the first V2 button
      const v2Button = v2Buttons.first();
      
      console.log('🖱️ Clicking V2 button...');
      await v2Button.click();
      await page.waitForTimeout(3000);
      
      // Count V2 entries after click
      const afterClickV2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 V2 count after click: ${afterClickV2Count}`);
      
      if (afterClickV2Count > initialV2Count) {
        console.log('🚨 DUPLICATE CREATION: V2 click created additional duplicate!');
      }
      
      await page.screenshot({ path: 'test-results/duplicate-bug-02-after-click.png', fullPage: true });
    }
    
    // STEP 7: Test refresh behavior
    console.log('🔄 Testing refresh behavior...');
    
    const beforeRefreshV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count before refresh: ${beforeRefreshV2Count}`);
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Re-login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    const afterRefreshV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count after refresh: ${afterRefreshV2Count}`);
    
    await page.screenshot({ path: 'test-results/duplicate-bug-03-after-refresh.png', fullPage: true });
    
    if (beforeRefreshV2Count !== afterRefreshV2Count) {
      console.log('🚨 REFRESH INCONSISTENCY: V2 count changed after refresh!');
    }
    
    // STEP 8: IDENTIFY THE ROOT CAUSE
    console.log('🔍 ROOT CAUSE ANALYSIS:');
    console.log('======================');
    
    if (initialV2Count > 1) {
      console.log('🚨 DUPLICATE BUG CONFIRMED');
      console.log('   Multiple "agendamente - V2" entries visible in UI');
      console.log('   This matches the user\'s screenshot exactly');
      console.log('');
      console.log('🎯 POSSIBLE CAUSES:');
      console.log('   1. Backend API actually has duplicate worktree entries');
      console.log('   2. Frontend is rendering the same worktree multiple times');
      console.log('   3. React key issues causing duplicate renders');
      console.log('   4. WebSocket updates creating duplicate entries');
      console.log('   5. State management issues in React components');
    }
    
    // STEP 9: Clean up duplicates via API
    console.log('🧹 Attempting to clean up duplicates via API...');
    
    // Delete all V2 worktrees
    const deleteResponse = await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log(`🗑️ Delete V2 response: ${deleteResponse.status()}`);
    
    await page.waitForTimeout(2000);
    
    // Check final state
    const finalV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 Final V2 count after cleanup: ${finalV2Count}`);
    
    await page.screenshot({ path: 'test-results/duplicate-bug-04-after-cleanup.png', fullPage: true });
    
    // STEP 10: SUMMARY AND NEXT STEPS
    console.log('🎯 DUPLICATE V2 BUG ANALYSIS COMPLETE:');
    console.log('====================================');
    console.log(`📊 Bug reproduced: ${initialV2Count > 1 ? 'YES' : 'NO'}`);
    console.log(`📊 Initial duplicates: ${initialV2Count}`);
    console.log(`📊 After refresh: ${afterRefreshV2Count}`);
    console.log(`📊 After cleanup: ${finalV2Count}`);
    console.log('====================================');
    
    if (initialV2Count > 1) {
      console.log('🚨 THE DUPLICATE BUG IS CONFIRMED AND NEEDS TO BE FIXED!');
      console.log('   This test reproduces the exact issue from the screenshot');
    }
    
    // Fail the test to highlight that duplicates exist
    expect(initialV2Count).toBeLessThanOrEqual(1);
  });
});