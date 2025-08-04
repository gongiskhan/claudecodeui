import { test, expect } from '@playwright/test';

test.describe('Comprehensive DOM Mapping', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('MAP ALL V3 ENTRIES: Find every single source of duplication', async ({ page }) => {
    console.log('🔍 COMPREHENSIVE MAPPING: Finding every source of V3 duplication');
    
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
        branch: 'feature/v3-comprehensive-debug',
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
    
    // STEP 3: COMPREHENSIVE DOM ANALYSIS - BEFORE MESSAGE
    console.log('\\n📊 BEFORE MESSAGE - COMPREHENSIVE DOM ANALYSIS:');
    console.log('===============================================');
    
    const beforeAnalysis = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const v3Elements = [];
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          
          // Get parent chain
          const parentChain = [];
          let parent = element.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            parentChain.push({
              tagName: parent.tagName,
              className: parent.className,
              id: parent.id || 'no-id'
            });
            parent = parent.parentElement;
          }
          
          // Get all React fiber keys
          const reactKeys = Object.keys(element).filter(key => 
            key.startsWith('__react') || key.startsWith('_react')
          );
          
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          
          if (!hasTextChildren) { // Only leaf nodes
            v3Elements.push({
              tagName: element.tagName,
              className: element.className,
              id: element.id || 'no-id',
              textContent: element.textContent.trim().substring(0, 100),
              isVisible: element.offsetParent !== null,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              zIndex: computedStyle.zIndex,
              position: computedStyle.position,
              inlineStyle: element.style.cssText || 'none',
              boundingRect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              parentChain: parentChain,
              reactKeys: reactKeys,
              elementIndex: Array.from(element.parentElement?.children || []).indexOf(element)
            });
          }
        }
      }
      
      return {
        totalElements: v3Elements.length,
        visibleElements: v3Elements.filter(e => e.isVisible).length,
        elements: v3Elements,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });
    
    console.log(`📊 Total V3 elements: ${beforeAnalysis.totalElements}`);
    console.log(`📊 Visible V3 elements: ${beforeAnalysis.visibleElements}`);
    console.log(`📱 Viewport: ${beforeAnalysis.viewport.width}x${beforeAnalysis.viewport.height}`);
    
    beforeAnalysis.elements.forEach((element, index) => {
      console.log(`\\n🔍 V3 Element ${index + 1} (BEFORE):`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: "${element.className}"`);
      console.log(`  ID: "${element.id}"`);
      console.log(`  Text: "${element.textContent}"`);
      console.log(`  Visible: ${element.isVisible}`);
      console.log(`  Display: ${element.display}`);
      console.log(`  Position: ${element.position} (z-index: ${element.zIndex})`);
      console.log(`  Bounds: ${element.boundingRect.x},${element.boundingRect.y} ${element.boundingRect.width}x${element.boundingRect.height}`);
      console.log(`  Inline Style: ${element.inlineStyle}`);
      console.log(`  Element Index: ${element.elementIndex}`);
      console.log(`  React Keys: ${element.reactKeys.join(', ') || 'none'}`);
      console.log(`  Parent Chain:`);
      element.parentChain.forEach((parent, i) => {
        console.log(`    ${i + 1}. ${parent.tagName}.${parent.className} (${parent.id})`);
      });
    });
    
    // STEP 4: Click V3 and send message to trigger duplication
    console.log('\\n🎯 TRIGGERING DUPLICATION...');
    
    // Click on first visible V3 element
    const v3Elements = await page.locator('text=agendamente - V3').all();
    if (v3Elements.length > 0) {
      for (const element of v3Elements) {
        if (await element.isVisible()) {
          try {
            await element.click();
            console.log('✅ Clicked V3 project');
            break;
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Create new session if needed
    const newSessionButton = page.locator('text=New Session').first();
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Send message
    const messageInput = page.locator('textarea').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('test message that triggers duplication');
      const sendButton = page.locator('button[type="submit"]').last();
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await messageInput.press('Enter');
      }
      await page.waitForTimeout(5000);
    }
    
    // STEP 5: COMPREHENSIVE DOM ANALYSIS - AFTER MESSAGE
    console.log('\\n📊 AFTER MESSAGE - COMPREHENSIVE DOM ANALYSIS:');
    console.log('==============================================');
    
    const afterAnalysis = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const v3Elements = [];
      
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          
          const parentChain = [];
          let parent = element.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            parentChain.push({
              tagName: parent.tagName,
              className: parent.className,
              id: parent.id || 'no-id'
            });
            parent = parent.parentElement;
          }
          
          const reactKeys = Object.keys(element).filter(key => 
            key.startsWith('__react') || key.startsWith('_react')
          );
          
          const hasTextChildren = Array.from(element.children).some(child => 
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          
          if (!hasTextChildren) {
            v3Elements.push({
              tagName: element.tagName,
              className: element.className,
              id: element.id || 'no-id',
              textContent: element.textContent.trim().substring(0, 100),
              isVisible: element.offsetParent !== null,
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              zIndex: computedStyle.zIndex,
              position: computedStyle.position,
              inlineStyle: element.style.cssText || 'none',
              boundingRect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              parentChain: parentChain,
              reactKeys: reactKeys,
              elementIndex: Array.from(element.parentElement?.children || []).indexOf(element)
            });
          }
        }
      }
      
      return {
        totalElements: v3Elements.length,
        visibleElements: v3Elements.filter(e => e.isVisible).length,
        elements: v3Elements
      };
    });
    
    console.log(`📊 Total V3 elements: ${afterAnalysis.totalElements}`);
    console.log(`📊 Visible V3 elements: ${afterAnalysis.visibleElements}`);
    
    afterAnalysis.elements.forEach((element, index) => {
      console.log(`\\n🔍 V3 Element ${index + 1} (AFTER):`);
      console.log(`  Tag: ${element.tagName}`);
      console.log(`  Class: "${element.className}"`);
      console.log(`  ID: "${element.id}"`);
      console.log(`  Text: "${element.textContent}"`);
      console.log(`  Visible: ${element.isVisible}`);
      console.log(`  Display: ${element.display}`);
      console.log(`  Position: ${element.position} (z-index: ${element.zIndex})`);
      console.log(`  Bounds: ${element.boundingRect.x},${element.boundingRect.y} ${element.boundingRect.width}x${element.boundingRect.height}`);
      console.log(`  Inline Style: ${element.inlineStyle}`);
      console.log(`  Element Index: ${element.elementIndex}`);
      console.log(`  React Keys: ${element.reactKeys.join(', ') || 'none'}`);
      console.log(`  Parent Chain:`);
      element.parentChain.forEach((parent, i) => {
        console.log(`    ${i + 1}. ${parent.tagName}.${parent.className} (${parent.id})`);
      });
    });
    
    // STEP 6: COMPARATIVE ANALYSIS
    console.log('\\n🔍 COMPARATIVE ANALYSIS:');
    console.log('========================');
    
    if (afterAnalysis.visibleElements > beforeAnalysis.visibleElements) {
      console.log(`🚨 DUPLICATION CONFIRMED: ${beforeAnalysis.visibleElements} → ${afterAnalysis.visibleElements} visible elements`);
      
      // Find new elements
      const newElements = afterAnalysis.elements.filter(afterEl => 
        !beforeAnalysis.elements.some(beforeEl => 
          beforeEl.tagName === afterEl.tagName &&
          beforeEl.className === afterEl.className &&
          beforeEl.boundingRect.x === afterEl.boundingRect.x &&
          beforeEl.boundingRect.y === afterEl.boundingRect.y
        )
      );
      
      console.log(`\\n🆕 NEW ELEMENTS ADDED: ${newElements.length}`);
      newElements.forEach((element, index) => {
        console.log(`  New ${index + 1}: ${element.tagName}.${element.className} at ${element.boundingRect.x},${element.boundingRect.y}`);
      });
      
      // Check for overlapping elements
      const visibleElements = afterAnalysis.elements.filter(e => e.isVisible);
      console.log(`\\n📍 OVERLAPPING ANALYSIS:`);
      for (let i = 0; i < visibleElements.length; i++) {
        for (let j = i + 1; j < visibleElements.length; j++) {
          const el1 = visibleElements[i];
          const el2 = visibleElements[j];
          
          // Check if elements overlap in position
          const overlaps = !(
            el1.boundingRect.x + el1.boundingRect.width < el2.boundingRect.x ||
            el2.boundingRect.x + el2.boundingRect.width < el1.boundingRect.x ||
            el1.boundingRect.y + el1.boundingRect.height < el2.boundingRect.y ||
            el2.boundingRect.y + el2.boundingRect.height < el1.boundingRect.y
          );
          
          if (overlaps) {
            console.log(`  ⚠️ OVERLAP: ${el1.tagName}.${el1.className} & ${el2.tagName}.${el2.className}`);
          }
        }
      }
      
    } else {
      console.log(`✅ No duplication: ${beforeAnalysis.visibleElements} → ${afterAnalysis.visibleElements} visible elements`);
    }
    
    await page.screenshot({ path: 'test-results/comprehensive-dom-mapping.png', fullPage: true });
    
    console.log('\\n✅ COMPREHENSIVE DOM MAPPING COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});