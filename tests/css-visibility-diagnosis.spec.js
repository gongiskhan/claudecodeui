import { test, expect } from '@playwright/test';

test.describe('CSS Visibility Diagnosis', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DIAGNOSE CSS VISIBILITY - MOBILE VS DESKTOP RENDERING', async ({ page }) => {
    console.log('🔍 DIAGNOSING: CSS visibility causing mobile/desktop duplication');
    
    // STEP 1: Setup - ensure single V2 worktree exists
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-css-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    await page.waitForTimeout(3000);
    
    // STEP 2: Navigate to UI and login
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 3: Analyze CSS visibility of mobile vs desktop elements
    console.log('🔍 Step 3: Analyzing CSS visibility of mobile vs desktop elements...');
    
    const cssAnalysis = await page.evaluate(() => {
      const results = {
        mobileElements: [],
        desktopElements: [],
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
      
      // Find mobile version (md:hidden)
      const mobileProjectDivs = document.querySelectorAll('.md\\:hidden');
      mobileProjectDivs.forEach((elem, index) => {
        if (elem.textContent && elem.textContent.includes('agendamente - V2')) {
          const computedStyle = window.getComputedStyle(elem);
          results.mobileElements.push({
            index,
            className: elem.className,
            isVisible: computedStyle.display !== 'none',
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            textContent: elem.textContent.substring(0, 50),
            boundingRect: {
              width: elem.getBoundingClientRect().width,
              height: elem.getBoundingClientRect().height,
              top: elem.getBoundingClientRect().top,
              left: elem.getBoundingClientRect().left
            }
          });
        }
      });
      
      // Find desktop version (hidden md:flex)
      const desktopButtons = document.querySelectorAll('button.hidden');
      desktopButtons.forEach((elem, index) => {
        if (elem.textContent && elem.textContent.includes('agendamente - V2')) {
          const computedStyle = window.getComputedStyle(elem);
          results.desktopElements.push({
            index,
            className: elem.className,
            isVisible: computedStyle.display !== 'none',
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            textContent: elem.textContent.substring(0, 50),
            boundingRect: {
              width: elem.getBoundingClientRect().width,
              height: elem.getBoundingClientRect().height,
              top: elem.getBoundingClientRect().top,
              left: elem.getBoundingClientRect().left
            }
          });
        }
      });
      
      return results;
    });
    
    console.log('📊 CSS VISIBILITY ANALYSIS:');
    console.log('==========================');
    console.log(`🖥️ Viewport: ${cssAnalysis.viewportWidth} x ${cssAnalysis.viewportHeight}`);
    console.log(`📱 Mobile elements (md:hidden): ${cssAnalysis.mobileElements.length}`);
    console.log(`💻 Desktop elements (hidden md:flex): ${cssAnalysis.desktopElements.length}`);
    
    console.log('\n📱 MOBILE ELEMENTS:');
    cssAnalysis.mobileElements.forEach((elem, i) => {
      console.log(`  Mobile ${i + 1}:`);
      console.log(`    - Class: ${elem.className}`);
      console.log(`    - Visible: ${elem.isVisible}`);
      console.log(`    - Display: ${elem.display}`);
      console.log(`    - Size: ${elem.boundingRect.width} x ${elem.boundingRect.height}`);
      console.log(`    - Position: (${elem.boundingRect.left}, ${elem.boundingRect.top})`);
      console.log(`    - Text: "${elem.textContent}"`);
    });
    
    console.log('\n💻 DESKTOP ELEMENTS:');
    cssAnalysis.desktopElements.forEach((elem, i) => {
      console.log(`  Desktop ${i + 1}:`);
      console.log(`    - Class: ${elem.className}`);
      console.log(`    - Visible: ${elem.isVisible}`);
      console.log(`    - Display: ${elem.display}`);
      console.log(`    - Size: ${elem.boundingRect.width} x ${elem.boundingRect.height}`);
      console.log(`    - Position: (${elem.boundingRect.left}, ${elem.boundingRect.top})`);
      console.log(`    - Text: "${elem.textContent}"`);
    });
    
    // STEP 4: Test different viewport sizes
    console.log('\n🔄 Step 4: Testing different viewport sizes...');
    
    // Test mobile size (768px is the md breakpoint)
    await page.setViewportSize({ width: 767, height: 800 });
    await page.waitForTimeout(1000);
    
    const mobileV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`📱 Mobile viewport (767px): ${mobileV2Count} V2 entries visible`);
    
    // Test desktop size
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(1000);
    
    const desktopV2Count = await page.locator('text=agendamente - V2').count();
    console.log(`💻 Desktop viewport (1024px): ${desktopV2Count} V2 entries visible`);
    
    // STEP 5: Final analysis
    console.log('\n🎯 CSS VISIBILITY DIAGNOSIS RESULTS:');
    console.log('====================================');
    
    if (mobileV2Count > 1) {
      console.log('🚨 MOBILE DUPLICATION: Multiple V2 entries visible on mobile viewport');
    } else {
      console.log('✅ Mobile viewport: Single V2 entry (correct)');
    }
    
    if (desktopV2Count > 1) {
      console.log('🚨 DESKTOP DUPLICATION: Multiple V2 entries visible on desktop viewport');
    } else {
      console.log('✅ Desktop viewport: Single V2 entry (correct)');
    }
    
    const bothVisible = cssAnalysis.mobileElements.some(e => e.isVisible) && 
                       cssAnalysis.desktopElements.some(e => e.isVisible);
    
    if (bothVisible) {
      console.log('🚨 ROOT CAUSE: Both mobile AND desktop versions are visible simultaneously!');
      console.log('   This indicates a CSS responsive design issue with Tailwind classes');
    }
    
    // Take screenshots at different sizes
    await page.setViewportSize({ width: 767, height: 800 });
    await page.screenshot({ path: 'test-results/css-mobile-767px.png', fullPage: true });
    
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.screenshot({ path: 'test-results/css-desktop-1024px.png', fullPage: true });
    
    // Test assertion
    expect(mobileV2Count).toBeLessThanOrEqual(1);
    expect(desktopV2Count).toBeLessThanOrEqual(1);
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ CSS VISIBILITY DIAGNOSIS COMPLETE');
  });
});