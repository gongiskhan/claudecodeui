import { test, expect } from '@playwright/test';

test.describe('UI Display After Successful Creation', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('UI DISPLAY AFTER CONFIRMED SUCCESSFUL V2 CREATION', async ({ page }) => {
    console.log('🔍 TESTING: UI display after confirmed successful V2 creation');
    
    // STEP 1: Clean slate
    console.log('🧹 Step 1: Cleaning...');
    await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    await page.waitForTimeout(1000);
    
    // STEP 2: Create V2 (using the same successful approach)
    console.log('📝 Step 2: Creating V2 worktree...');
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-ui-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    console.log(`✅ Create response: ${createResponse.status()}`);
    expect(createResponse.ok()).toBeTruthy();
    
    // STEP 3: Confirm API has V2 project
    await page.waitForTimeout(3000);
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    
    console.log(`📊 API confirmation: ${apiV2Count} V2 projects found`);
    expect(apiV2Count).toBe(1);
    
    // STEP 4: Navigate to UI AFTER confirmed successful creation
    console.log('🌐 Step 4: Navigating to UI after confirmed creation...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // STEP 5: Login
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      console.log('🔐 Logging in...');
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(7000); // Wait longer for full load
    }
    
    // STEP 6: Check UI display
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 UI V2 count: ${uiV2Count}`);
    
    // STEP 7: If no V2 entries, debug the UI state  
    if (uiV2Count === 0) {
      console.log('🔍 Debugging UI state - no V2 entries found...');
      
      // Check if any projects are showing at all
      const totalProjectElements = await page.locator('[class*="project"], [class*="folder"], button:has-text("agendamente")').count();
      console.log(`📊 Total project-like elements: ${totalProjectElements}`);
      
      // Check if the base agendamente project is showing
      const baseProjectCount = await page.locator('text=agendamente').count();
      console.log(`📊 Base "agendamente" text count: ${baseProjectCount}`);
      
      // Check page content
      const pageText = await page.textContent('body');
      const hasAgendamenteText = pageText.includes('agendamente');
      const hasV2Text = pageText.includes('V2');
      
      console.log(`📊 Page contains "agendamente": ${hasAgendamenteText}`);
      console.log(`📊 Page contains "V2": ${hasV2Text}`);
      
      // Check for auth issues
      const hasLoginForm = await page.locator('input[type="password"]').isVisible();
      const hasErrorText = pageText.includes('error') || pageText.includes('Error');
      
      console.log(`📊 Has login form visible: ${hasLoginForm}`);
      console.log(`📊 Has error text: ${hasErrorText}`);
      
      // Force refresh and recheck
      console.log('🔄 Force refreshing UI...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      const afterRefreshV2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 V2 count after refresh: ${afterRefreshV2Count}`);
    }
    
    // STEP 8: Multiple checks with intervals
    console.log('🕐 Multiple UI checks at intervals...');
    
    for (let i = 1; i <= 3; i++) {
      await page.waitForTimeout(2000);
      const intervalV2Count = await page.locator('text=agendamente - V2').count();
      console.log(`📊 UI check ${i}: ${intervalV2Count} V2 entries`);
    }
    
    // STEP 9: Take screenshot for visual inspection
    await page.screenshot({ path: 'test-results/ui-after-successful-creation.png', fullPage: true });
    
    // STEP 10: Final API confirmation that V2 still exists
    const finalApiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const finalApiProjects = await finalApiResponse.json();
    const finalApiV2Count = finalApiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    
    console.log('\n🎯 UI DISPLAY TEST RESULTS:');
    console.log('==========================');
    console.log(`📊 API V2 count (initial): ${apiV2Count}`);
    console.log(`📊 API V2 count (final): ${finalApiV2Count}`);
    console.log(`📊 UI V2 count: ${uiV2Count}`);
    
    if (finalApiV2Count === 1 && uiV2Count === 0) {
      console.log('🚨 FRONTEND DISPLAY ISSUE CONFIRMED');
      console.log('   API has V2 project but UI is not displaying it');
      console.log('   This is a React rendering or state management issue');
    } else if (finalApiV2Count === 1 && uiV2Count === 1) {
      console.log('✅ FRONTEND DISPLAY WORKING');
      console.log('   Both API and UI show exactly 1 V2 project');
    } else if (finalApiV2Count === 1 && uiV2Count > 1) {
      console.log('🚨 DUPLICATION ISSUE CONFIRMED');
      console.log('   API has 1 V2 project but UI shows multiple');
    }
    
    console.log('✅ UI DISPLAY TEST COMPLETE');
    
    // Don't fail the test - we're gathering diagnostic info
    // expect(uiV2Count).toBe(1);
  });
});