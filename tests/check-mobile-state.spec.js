import { test, expect } from '@playwright/test';

test.describe('Check Mobile State', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('CHECK MOBILE STATE AND VIEWPORT', async ({ page }) => {
    console.log('🔍 CHECKING: Mobile state and viewport in test environment');
    
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
        branch: 'feature/v2-viewport-test',
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
    
    // STEP 3: Check viewport and mobile state
    const viewportInfo = await page.evaluate(() => {
      return {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        isMobileBreakpoint: window.innerWidth < 768,
        bodyClasses: document.body.className,
        htmlClasses: document.documentElement.className
      };
    });
    
    console.log('📊 VIEWPORT INFORMATION:');
    console.log(`  Window width: ${viewportInfo.windowWidth}px`);
    console.log(`  Window height: ${viewportInfo.windowHeight}px`);
    console.log(`  Is mobile breakpoint: ${viewportInfo.isMobileBreakpoint}`);
    console.log(`  Body classes: "${viewportInfo.bodyClasses}"`);
    console.log(`  HTML classes: "${viewportInfo.htmlClasses}"`);
    
    // STEP 4: Check V2 count at current viewport
    const currentV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count at current viewport: ${currentV2Count}`);
    
    // STEP 5: Test different viewport sizes
    console.log('\n📱 TESTING MOBILE VIEWPORT (767px):');
    await page.setViewportSize({ width: 767, height: 800 });
    await page.waitForTimeout(2000);
    
    const mobileV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count on mobile: ${mobileV2Count}`);
    
    console.log('\n💻 TESTING DESKTOP VIEWPORT (1024px):');
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(2000);
    
    const desktopV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count on desktop: ${desktopV2Count}`);
    
    console.log('\n💻 TESTING LARGE DESKTOP VIEWPORT (1280px):');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(2000);
    
    const largeDesktopV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📊 V2 count on large desktop: ${largeDesktopV2Count}`);
    
    // STEP 6: Check DOM elements for both mobile and desktop versions
    const domAnalysis = await page.evaluate(() => {
      // Look for mobile version elements
      const mobileElements = document.querySelectorAll('[class*="md:hidden"]');
      const mobileV2Elements = [];
      mobileElements.forEach(elem => {
        if (elem.textContent && elem.textContent.includes('agendamente - V2')) {
          mobileV2Elements.push({
            className: elem.className,
            isVisible: elem.offsetParent !== null,
            display: window.getComputedStyle(elem).display
          });
        }
      });
      
      // Look for desktop version elements (buttons)
      const desktopButtons = document.querySelectorAll('button');
      const desktopV2Elements = [];
      desktopButtons.forEach(elem => {
        if (elem.textContent && elem.textContent.includes('agendamente - V2')) {
          desktopV2Elements.push({
            className: elem.className,
            isVisible: elem.offsetParent !== null,
            display: window.getComputedStyle(elem).display
          });
        }
      });
      
      return {
        mobileV2Elements: mobileV2Elements.length,
        desktopV2Elements: desktopV2Elements.length,
        mobileDetails: mobileV2Elements,
        desktopDetails: desktopV2Elements
      };
    });
    
    console.log('\n🔍 DOM ANALYSIS:');
    console.log(`📱 Mobile V2 elements found: ${domAnalysis.mobileV2Elements}`);
    console.log(`💻 Desktop V2 elements found: ${domAnalysis.desktopV2Elements}`);
    
    if (domAnalysis.mobileDetails.length > 0) {
      console.log('📱 Mobile element details:');
      domAnalysis.mobileDetails.forEach((elem, i) => {
        console.log(`  Mobile ${i + 1}: visible=${elem.isVisible}, display=${elem.display}`);
      });
    }
    
    if (domAnalysis.desktopDetails.length > 0) {
      console.log('💻 Desktop element details:');
      domAnalysis.desktopDetails.forEach((elem, i) => {
        console.log(`  Desktop ${i + 1}: visible=${elem.isVisible}, display=${elem.display}`);
      });
    }
    
    // STEP 7: Take screenshots at different sizes
    await page.setViewportSize({ width: 767, height: 800 });
    await page.screenshot({ path: 'test-results/mobile-state-767px.png', fullPage: true });
    
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: 'test-results/mobile-state-1280px.png', fullPage: true });
    
    console.log('\n🎯 MOBILE STATE CHECK RESULTS:');
    console.log(`📊 Mobile (767px): ${mobileV2Count} V2 entries`);
    console.log(`📊 Desktop (1024px): ${desktopV2Count} V2 entries`);
    console.log(`📊 Large Desktop (1280px): ${largeDesktopV2Count} V2 entries`);
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ MOBILE STATE CHECK COMPLETE');
  });
});