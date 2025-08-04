import { test, expect } from '@playwright/test';

test.describe('Debug Projects Logging', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('CAPTURE DEBUG LOGS - PROJECTS ARRAY STRUCTURE', async ({ page }) => {
    console.log('🔍 CAPTURING: Debug logs from Sidebar component');
    
    // STEP 1: Setup single V2 worktree
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-debug-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    await page.waitForTimeout(3000);
    
    // STEP 2: Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DUPLICATE V2 PROJECTS') || text.includes('V2 Project') || text.includes('name:') || text.includes('displayName:')) {
        consoleLogs.push(text);
      }
    });
    
    // STEP 3: Navigate and login to trigger debug logging
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(7000); // Wait longer for debug logs
    }
    
    // STEP 4: Trigger refresh to ensure logging happens
    await page.reload();
    await page.waitForTimeout(5000);
    
    // STEP 5: Check for V2 entries in UI
    const v2Count = await page.locator('text=agendamente - V2').count();
    
    // STEP 6: Log results
    console.log('📊 DEBUG LOGGING RESULTS:');
    console.log('========================');
    console.log(`📊 V2 entries in UI: ${v2Count}`);
    console.log('📋 Console logs captured:');
    
    if (consoleLogs.length > 0) {
      consoleLogs.forEach(log => {
        console.log(`  ${log}`);
      });
    } else {
      console.log('  No debug logs captured (may indicate single V2 project)');
    }
    
    // STEP 7: Manual verification
    console.log('\n🔍 MANUAL VERIFICATION:');
    if (v2Count > 1 && consoleLogs.length === 0) {
      console.log('🚨 UI shows duplicates but no debug logs = Issue is NOT in projects array');
      console.log('   The duplication happens in rendering logic, not data structure');
    } else if (v2Count > 1 && consoleLogs.length > 0) {
      console.log('🚨 UI shows duplicates AND debug logs captured = Issue IS in projects array');
      console.log('   The projects array contains duplicate entries');
    } else {
      console.log('✅ No duplication detected');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-projects-logging.png', fullPage: true });
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ DEBUG LOGGING CAPTURE COMPLETE');
    
    // Test will pass regardless - we're just capturing debug info
    expect(true).toBe(true);
  });
});