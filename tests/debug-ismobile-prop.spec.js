import { test, expect } from '@playwright/test';

test.describe('Debug isMobile Prop', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DEBUG: Check isMobile prop values in React components', async ({ page }) => {
    console.log('🔍 DEBUG: Checking isMobile prop values and rendering logic');
    
    // STEP 1: Setup V3 worktree
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-ismobile-debug',
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
    
    // STEP 3: Inject debugging script to inspect React components
    const debugInfo = await page.evaluate(() => {
      // Function to find React fiber nodes and inspect props
      function findReactProps(element) {
        // Check for React DevTools keys
        const keys = Object.keys(element);
        const reactKey = keys.find(key => 
          key.startsWith('__reactInternalInstance') || 
          key.startsWith('__reactFiber') ||
          key.startsWith('_reactInternalFiber') ||
          key.startsWith('_reactInternals')
        );
        
        if (reactKey) {
          const fiber = element[reactKey];
          return fiber?.memoizedProps || fiber?.pendingProps || null;
        }
        return null;
      }
      
      // Find all V3 elements and their React props
      const allElements = document.querySelectorAll('*');
      const v3ElementsInfo = [];
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const isVisible = element.offsetParent !== null;
          
          // Get React props if available
          const reactProps = findReactProps(element);
          
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          
          if (!hasTextChildren) { // Only leaf nodes
            v3ElementsInfo.push({
              tagName: element.tagName,
              className: element.className,
              isVisible: isVisible,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              parentClassName: element.parentElement?.className || 'no-parent',
              hasReactProps: !!reactProps,
              isMobileProp: reactProps?.isMobile,
              allPropKeys: reactProps ? Object.keys(reactProps) : [],
              inlineStyle: element.style.cssText || 'none'
            });
          }
        }
      }
      
      // Also check if we can find the Sidebar component specifically
      const sidebarElements = document.querySelectorAll('[class*="sidebar"], [class*="Sidebar"]');
      const sidebarPropsInfo = [];
      
      for (let element of sidebarElements) {
        const reactProps = findReactProps(element);
        if (reactProps && 'isMobile' in reactProps) {
          sidebarPropsInfo.push({
            element: element.className,
            isMobile: reactProps.isMobile,
            allProps: Object.keys(reactProps)
          });
        }
      }
      
      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          isMobileBreakpoint: window.innerWidth < 768
        },
        v3Elements: v3ElementsInfo,
        sidebarProps: sidebarPropsInfo,
        totalV3Elements: v3ElementsInfo.length,
        visibleV3Elements: v3ElementsInfo.filter(e => e.isVisible).length
      };
    });
    
    console.log('\\n📊 INITIAL DEBUG INFO:');
    console.log('======================');
    console.log(`📱 Viewport: ${debugInfo.viewport.width}x${debugInfo.viewport.height}`);
    console.log(`📱 Is mobile breakpoint: ${debugInfo.viewport.isMobileBreakpoint}`);
    console.log(`📊 Total V3 elements: ${debugInfo.totalV3Elements}`);
    console.log(`📊 Visible V3 elements: ${debugInfo.visibleV3Elements}`);
    
    debugInfo.v3Elements.forEach((element, index) => {
      console.log(`\\n🔍 V3 Element ${index + 1}:`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: "${element.className}"`);
      console.log(`  Parent: "${element.parentClassName}"`);
      console.log(`  Visible: ${element.isVisible}`);
      console.log(`  Display: ${element.display}`);
      console.log(`  Has React Props: ${element.hasReactProps}`);
      console.log(`  isMobile Prop: ${element.isMobileProp}`);
      console.log(`  Inline Style: ${element.inlineStyle}`);
      console.log(`  All Props: ${element.allPropKeys.join(', ')}`);
    });
    
    if (debugInfo.sidebarProps.length > 0) {
      console.log('\\n📋 SIDEBAR COMPONENT PROPS:');
      debugInfo.sidebarProps.forEach((info, index) => {
        console.log(`  Sidebar ${index + 1}: isMobile=${info.isMobile}`);
      });
    } else {
      console.log('\\n❌ Could not find Sidebar component props');
    }
    
    // STEP 4: Click V3 and send message to trigger duplication
    console.log('\\n🎯 TRIGGERING DUPLICATION...');
    
    const v3Elements = await page.locator('text=agendamente - V3').all();
    if (v3Elements.length > 0 && await v3Elements[0].isVisible()) {
      await v3Elements[0].click();
      await page.waitForTimeout(2000);
      
      // Send a message
      const messageInput = page.locator('textarea').first();
      if (await messageInput.isVisible()) {
        await messageInput.fill('test message');
        const sendButton = page.locator('button[type="submit"]').last();
        if (await sendButton.isVisible()) {
          await sendButton.click();
        } else {
          await messageInput.press('Enter');
        }
        await page.waitForTimeout(3000);
      }
    }
    
    // STEP 5: Check debug info AFTER message (when duplication occurs)
    const debugInfoAfter = await page.evaluate(() => {
      function findReactProps(element) {
        const keys = Object.keys(element);
        const reactKey = keys.find(key => 
          key.startsWith('__reactInternalInstance') || 
          key.startsWith('__reactFiber') ||
          key.startsWith('_reactInternalFiber') ||
          key.startsWith('_reactInternals')
        );
        
        if (reactKey) {
          const fiber = element[reactKey];
          return fiber?.memoizedProps || fiber?.pendingProps || null;
        }
        return null;
      }
      
      const allElements = document.querySelectorAll('*');
      const v3ElementsInfo = [];
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const isVisible = element.offsetParent !== null;
          
          const reactProps = findReactProps(element);
          
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          
          if (!hasTextChildren) {
            v3ElementsInfo.push({
              tagName: element.tagName,
              className: element.className,
              isVisible: isVisible,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              parentClassName: element.parentElement?.className || 'no-parent',
              hasReactProps: !!reactProps,
              isMobileProp: reactProps?.isMobile,
              allPropKeys: reactProps ? Object.keys(reactProps) : [],
              inlineStyle: element.style.cssText || 'none'
            });
          }
        }
      }
      
      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          isMobileBreakpoint: window.innerWidth < 768
        },
        v3Elements: v3ElementsInfo,
        totalV3Elements: v3ElementsInfo.length,
        visibleV3Elements: v3ElementsInfo.filter(e => e.isVisible).length
      };
    });
    
    console.log('\\n📊 DEBUG INFO AFTER MESSAGE (DUPLICATION STATE):');
    console.log('===============================================');
    console.log(`📊 Total V3 elements: ${debugInfoAfter.totalV3Elements}`);
    console.log(`📊 Visible V3 elements: ${debugInfoAfter.visibleV3Elements}`);
    
    debugInfoAfter.v3Elements.forEach((element, index) => {
      console.log(`\\n🔍 V3 Element ${index + 1} (AFTER):`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: "${element.className}"`);
      console.log(`  Parent: "${element.parentClassName}"`);
      console.log(`  Visible: ${element.isVisible}`);
      console.log(`  Display: ${element.display}`);
      console.log(`  Has React Props: ${element.hasReactProps}`);
      console.log(`  isMobile Prop: ${element.isMobileProp}`);
      console.log(`  Inline Style: ${element.inlineStyle}`);
    });
    
    // STEP 6: Analysis
    console.log('\\n🎯 ANALYSIS:');
    console.log('============');
    
    if (debugInfoAfter.visibleV3Elements > 1) {
      console.log('🚨 DUPLICATION CONFIRMED: Multiple visible V3 elements');
      
      // Check if both mobile and desktop versions are visible
      const mobileElements = debugInfoAfter.v3Elements.filter(e => 
        e.isVisible && (e.className.includes('md:hidden') || e.inlineStyle.includes('isMobile ? \'block\''))
      );
      const desktopElements = debugInfoAfter.v3Elements.filter(e => 
        e.isVisible && (e.className.includes('hidden md:flex') || e.inlineStyle.includes('isMobile ? \'none\''))
      );
      
      console.log(`📱 Mobile elements visible: ${mobileElements.length}`);
      console.log(`💻 Desktop elements visible: ${desktopElements.length}`);
      
      if (mobileElements.length > 0 && desktopElements.length > 0) {
        console.log('🚨 ROOT CAUSE: Both mobile and desktop versions are visible simultaneously');
        console.log('   This suggests the isMobile prop or JavaScript styles are not working correctly');
      }
    } else {
      console.log('✅ No duplication detected');
    }
    
    await page.screenshot({ path: 'test-results/ismobile-debug.png', fullPage: true });
    
    console.log('✅ isMobile PROP DEBUG COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});