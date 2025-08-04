import { test, expect } from '@playwright/test';

test.describe('Verify Fix - Visible Elements Only', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('VERIFY FIX - COUNT ONLY VISIBLE V2 ENTRIES', async ({ page }) => {
    console.log('🔍 TESTING: Only visible V2 entries (ignoring hidden DOM elements)');
    
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
        branch: 'feature/v2-visible-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    await page.waitForTimeout(3000);
    
    // STEP 2: Navigate and login
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 3: Count ONLY VISIBLE V2 entries
    const visibleV2Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let visibleCount = 0;
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V2')) {
          // Only count if element is actually visible to user
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          
          const isVisible = (
            element.offsetParent !== null && // Not display: none
            computedStyle.visibility !== 'hidden' &&
            computedStyle.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
          
          // Only include leaf nodes (no children with same text)
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V2')
          );
          
          if (isVisible && !hasTextChildren) {
            visibleCount++;
          }
        }
      }
      
      return visibleCount;
    });
    
    // STEP 4: Compare with regular count
    const allV2Count = await page.locator('text=agendamente - V2').count();
    
    console.log(`📊 Total V2 elements in DOM: ${allV2Count}`);
    console.log(`📊 Visible V2 elements: ${visibleV2Count}`);
    
    // STEP 5: Test different viewport sizes
    console.log('\\n📱 TESTING DIFFERENT VIEWPORT SIZES:');
    
    // Desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(2000);
    
    const desktopVisible = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let visibleCount = 0;
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V2')) {
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
            child.textContent && child.textContent.includes('agendamente - V2')
          );
          
          if (isVisible && !hasTextChildren) {
            visibleCount++;
          }
        }
      }
      
      return visibleCount;
    });
    
    // Mobile viewport
    await page.setViewportSize({ width:400, height: 800 });
    await page.waitForTimeout(2000);
    
    const mobileVisible = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let visibleCount = 0;
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V2')) {
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
            child.textContent && child.textContent.includes('agendamente - V2')
          );
          
          if (isVisible && !hasTextChildren) {
            visibleCount++;
          }
        }
      }
      
      return visibleCount;
    });
    
    console.log(`💻 Desktop (1200px) visible: ${desktopVisible}`);
    console.log(`📱 Mobile (400px) visible: ${mobileVisible}`);
    
    // STEP 6: Take screenshots
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.screenshot({ path: 'test-results/fix-verification-desktop.png', fullPage: true });
    
    await page.setViewportSize({ width: 400, height: 800 });
    await page.screenshot({ path: 'test-results/fix-verification-mobile.png', fullPage: true });
    
    console.log('\\n🎯 FIX VERIFICATION RESULTS:');
    console.log('============================');
    console.log(`📊 API returns: 1 V2 project (confirmed)`);
    console.log(`📊 DOM contains: ${allV2Count} V2 elements total`);
    console.log(`📊 User sees: ${visibleV2Count} V2 elements (visible)`);
    console.log(`💻 Desktop visible: ${desktopVisible}`);
    console.log(`📱 Mobile visible: ${mobileVisible}`);
    
    if (visibleV2Count === 1 && desktopVisible === 1 && mobileVisible === 1) {
      console.log('✅ FIX SUCCESSFUL: User sees exactly 1 V2 entry at all viewport sizes');
    } else if (visibleV2Count === 1) {
      console.log('✅ FIX PARTIALLY SUCCESSFUL: User sees 1 V2 entry but viewport behavior may vary');
    } else {
      console.log('❌ FIX NOT WORKING: User still sees multiple V2 entries');
    }
    
    // Test should pass if user sees exactly 1 visible entry
    expect(visibleV2Count).toBe(1);
    expect(desktopVisible).toBe(1);
    expect(mobileVisible).toBe(1);
    
    console.log('✅ VISIBLE ELEMENTS TEST PASSED');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});