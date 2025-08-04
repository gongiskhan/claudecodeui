import { test, expect } from '@playwright/test';

test.describe('Direct UI Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DIRECT UI CHECK - NO CLEANUP', async ({ page }) => {
    console.log('🔍 DIRECT TEST: Check UI state without any cleanup');
    
    // STEP 1: Console log capture
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('PROJECTS DEBUG') || text.includes('V2') || text.includes('Original') || text.includes('Filtered')) {
        consoleLogs.push(text);
      }
    });
    
    // STEP 2: Navigate to UI first
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    // STEP 3: Login
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(7000); // Wait for initial load
    }
    
    // STEP 4: Check current state - NO WORKTREE CREATION, just check what exists
    const initialV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 Initial V2 count in UI: ${initialV2Count}`);
    
    // STEP 5: Check API state directly
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const apiV2Count = apiProjects.filter(p => p.displayName === 'agendamente - V2').length;
    
    console.log(`📊 API V2 count: ${apiV2Count}`);
    console.log('📋 All API projects:');
    apiProjects.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}] - ${p.name}`);
    });
    
    // STEP 6: Create V2 if it doesn't exist, then recheck
    if (apiV2Count === 0) {
      console.log('📝 Creating V2 worktree for testing...');
      
      await page.request.post('http://localhost:3000/api/worktree/create/V2', {
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: {
          branch: 'feature/v2-direct-test',
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        }
      });
      
      await page.waitForTimeout(5000); // Wait for creation and UI update
    }
    
    // STEP 7: Final check after creation
    const finalV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 Final V2 count in UI: ${finalV2Count}`);
    
    // STEP 8: Log captured console messages
    console.log('📋 Console logs captured:');
    if (consoleLogs.length > 0) {
      consoleLogs.forEach(log => {
        console.log(`  ${log}`);
      });
    } else {
      console.log('  No debug logs captured');
    }
    
    // STEP 9: Take screenshot for manual inspection
    await page.screenshot({ path: 'test-results/direct-ui-test.png', fullPage: true });
    
    // STEP 10: Analysis
    console.log('\n🎯 DIRECT UI TEST RESULTS:');
    console.log(`📊 Final UI V2 count: ${finalV2Count}`);
    console.log(`📊 Expected count: 1`);
    
    if (finalV2Count > 1) {
      console.log('🚨 DUPLICATION CONFIRMED in direct test');
      console.log('   Issue persists even in direct testing');
    } else {
      console.log('✅ No duplication in direct test');
      console.log('   Issue may be test-specific or timing-related');
    }
    
    // NO CLEANUP - leave as is for manual inspection
    console.log('✅ DIRECT UI TEST COMPLETE (no cleanup performed)');
  });
});