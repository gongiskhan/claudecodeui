import { test, expect } from '@playwright/test';

test.describe('Debug DOM Structure', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DEBUG DOM STRUCTURE FOR V2 ENTRIES', async ({ page }) => {
    console.log('🔍 DEBUGGING: DOM structure for V2 entries');
    
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
        branch: 'feature/v2-dom-debug',
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
    
    // STEP 3: Detailed DOM analysis
    const domAnalysis = await page.evaluate(() => {
      // Find all elements containing "agendamente - V2"
      const allElements = document.querySelectorAll('*');
      const v2Elements = [];
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V2')) {
          // Only include leaf nodes (no children with text)
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V2')
          );
          
          if (!hasTextChildren) {
            const computedStyle = window.getComputedStyle(element);
            v2Elements.push({
              tagName: element.tagName,
              className: element.className,
              textContent: element.textContent.trim(),
              isVisible: element.offsetParent !== null,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              parentClassName: element.parentElement?.className || 'no-parent',
              hasClickHandler: element.onclick !== null,
              dataAttributes: Array.from(element.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => `${attr.name}=${attr.value}`)
                .join(', ') || 'none'
            });
          }
        }
      }
      
      return {
        totalV2Elements: v2Elements.length,
        v2Elements: v2Elements,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          isMobileBreakpoint: window.innerWidth < 768
        }
      };
    });
    
    console.log('\\n📊 DOM ANALYSIS RESULTS:');
    console.log('========================');
    console.log(`📱 Viewport: ${domAnalysis.viewport.width}x${domAnalysis.viewport.height}`);
    console.log(`📱 Is mobile breakpoint: ${domAnalysis.viewport.isMobileBreakpoint}`);
    console.log(`📊 Total V2 elements found: ${domAnalysis.totalV2Elements}`);
    
    domAnalysis.v2Elements.forEach((element, index) => {
      console.log(`\\n🔍 V2 Element ${index + 1}:`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: "${element.className}"`);
      console.log(`  Parent Class: "${element.parentClassName}"`);
      console.log(`  Text: "${element.textContent}"`);
      console.log(`  Visible: ${element.isVisible}`);
      console.log(`  Display: ${element.display}`);
      console.log(`  Visibility: ${element.visibility}`);
      console.log(`  Opacity: ${element.opacity}`);
      console.log(`  Click Handler: ${element.hasClickHandler}`);
      console.log(`  Data Attributes: ${element.dataAttributes}`);
    });
    
    // STEP 4: Check React props being passed
    const reactPropsAnalysis = await page.evaluate(() => {
      // Try to find React fiber nodes and props
      const sidebarElements = document.querySelectorAll('[class*="sidebar"], [class*="Sidebar"]');
      const propsInfo = [];
      
      for (let element of sidebarElements) {
        const reactFiber = element._reactInternalFiber || element._reactInternals;
        if (reactFiber && reactFiber.memoizedProps) {
          propsInfo.push({
            element: element.className,
            hasIsMobileProp: 'isMobile' in reactFiber.memoizedProps,
            isMobileValue: reactFiber.memoizedProps.isMobile,
            allProps: Object.keys(reactFiber.memoizedProps)
          });
        }
      }
      
      return propsInfo;
    });
    
    console.log('\\n🔍 REACT PROPS ANALYSIS:');
    console.log('========================');
    if (reactPropsAnalysis.length > 0) {
      reactPropsAnalysis.forEach((info, index) => {
        console.log(`\\n📋 Component ${index + 1}:`);
        console.log(`  Element: ${info.element}`);
        console.log(`  Has isMobile prop: ${info.hasIsMobileProp}`);
        console.log(`  isMobile value: ${info.isMobileValue}`);
        console.log(`  All props: ${info.allProps.join(', ')}`);
      });
    } else {
      console.log('  No React props found');
    }
    
    // STEP 5: Take screenshot
    await page.screenshot({ path: 'test-results/dom-structure-debug.png', fullPage: true });
    
    // STEP 6: Test different viewport sizes
    console.log('\\n📱 TESTING DIFFERENT VIEWPORT SIZES:');
    console.log('====================================');
    
    // Mobile viewport
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(2000);
    
    const mobileCount = await page.locator('text=agendamente - V2').count();
    console.log(`📱 Mobile (400px): ${mobileCount} V2 entries`);
    
    // Desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(2000);
    
    const desktopCount = await page.locator('text=agendamente - V2').count();
    console.log(`💻 Desktop (1200px): ${desktopCount} V2 entries`);
    
    console.log('✅ DOM STRUCTURE DEBUG COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});