import { test, expect } from '@playwright/test';

test.describe('Reproduce Duplication', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('REPRODUCE EXACT VERIFICATION TEST CONDITIONS', async ({ page }) => {
    console.log('🔍 REPRODUCING: Exact conditions from verification test');
    
    // Console log capture
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
    });
    
    // STEP 1: Clean slate - EXACTLY like verification test
    console.log('🧹 Step 1: Cleaning all worktrees...');
    const versions = ['V2', 'V3', 'V4'];
    for (const version of versions) {
      await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    await page.waitForTimeout(2000);
    
    // STEP 2: Create ONE V2 worktree - EXACTLY like verification test
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
    
    // STEP 3: Check API state - EXACTLY like verification test
    console.log('📊 Step 3: Checking API state...');
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    expect(apiResponse.ok()).toBeTruthy();
    const apiProjects = await apiResponse.json();
    
    const v2Projects = apiProjects.filter(p => p.displayName === 'agendamente - V2');
    console.log(`📋 API V2 projects: ${v2Projects.length}`);
    
    // STEP 4: Navigate to UI - EXACTLY like verification test
    console.log('🌐 Step 4: Navigating to UI...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // STEP 5: Login - EXACTLY like verification test
    const usernameField = page.locator('input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await passwordField.fill('testpass123');
      await submitButton.click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 6: Count V2 entries in UI - EXACTLY like verification test
    const uiV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 UI V2 count: ${uiV2Count}`);
    
    // STEP 7: Multiple checks at different intervals
    console.log('🕐 Step 7: Multiple UI checks at intervals...');
    
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(2000);
      const intervalCount = await page.locator('text=agendamente - V2').count();
      console.log(`📊 UI V2 count at interval ${i}: ${intervalCount}`);
    }
    
    // STEP 8: Force refresh and recheck
    console.log('🔄 Step 8: Force refresh and recheck...');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Re-login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    const afterRefreshCount = await page.locator('text=agendamente - V2').count();
    console.log(`📊 UI V2 count after refresh: ${afterRefreshCount}`);
    
    // STEP 9: Log all captured console messages
    console.log('📋 All console logs:');
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('PROJECTS DEBUG') || 
      log.includes('V2') || 
      log.includes('Original') || 
      log.includes('Filtered') ||
      log.includes('projects') ||
      log.includes('count')
    );
    
    if (relevantLogs.length > 0) {
      relevantLogs.forEach(log => {
        console.log(`  ${log}`);
      });
    } else {
      console.log('  No relevant console logs captured');
    }
    
    // STEP 10: Take screenshot for comparison
    await page.screenshot({ path: 'test-results/reproduce-duplication.png', fullPage: true });
    
    // STEP 11: Final analysis
    console.log('\n🎯 REPRODUCTION TEST RESULTS:');
    console.log('=============================');
    console.log(`📊 API V2 projects: ${v2Projects.length}`);
    console.log(`📊 UI V2 count: ${uiV2Count}`);
    console.log(`📊 UI V2 count after refresh: ${afterRefreshCount}`);
    
    if (uiV2Count > 1 || afterRefreshCount > 1) {
      console.log('🚨 DUPLICATION REPRODUCED!');
      console.log('   The issue has been successfully reproduced');
    } else {
      console.log('✅ No duplication reproduced');
      console.log('   Issue may be intermittent or environment-specific');
    }
    
    console.log('✅ REPRODUCTION TEST COMPLETE');
  });
});