import { test, expect } from '@playwright/test';

test.describe('Debug Delete Button Visibility', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DEBUG: Find out why delete buttons are not visible', async ({ page }) => {
    console.log('🔍 DEBUGGING: Delete button visibility issue');
    
    // STEP 1: Create fresh worktree for testing
    console.log('🏗️ Step 1: Creating fresh V7 worktree...');
    
    await page.request.delete(`http://localhost:3000/api/worktree/V7`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V7', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v7-delete-debug',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    console.log('✅ V7 worktree created');
    await page.waitForTimeout(3000);
    
    // STEP 2: Navigate to UI
    console.log('🌐 Step 2: Navigating to UI...');
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 3: Check if V7 appears
    console.log('📊 Step 3: Checking if V7 appears in UI...');
    
    const v7Count = await page.locator('text=agendamente - V7').count();
    console.log(`📋 V7 entries found: ${v7Count}`);
    
    // STEP 4: Comprehensive button analysis
    console.log('🔍 Step 4: Comprehensive delete button analysis...');
    
    const buttonAnalysis = await page.evaluate(() => {
      // Find all V7 related elements
      const v7Elements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('agendamente - V7')
      );
      
      console.log(`Found ${v7Elements.length} V7 elements`);
      
      const analysis = {
        v7ElementsFound: v7Elements.length,
        deleteButtonsAnalysis: [],
        allButtonsNearV7: []
      };
      
      // For each V7 element, look for nearby buttons
      v7Elements.forEach((v7El, index) => {
        console.log(`Analyzing V7 element ${index + 1}:`, v7El.tagName, v7El.className);
        
        // Look up the DOM tree for delete buttons
        let parent = v7El;
        for (let level = 0; level < 8 && parent; level++) {
          const buttons = parent.querySelectorAll('button');
          buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            const styles = window.getComputedStyle(btn);
            
            analysis.allButtonsNearV7.push({
              level: level,
              tagName: btn.tagName,
              className: btn.className,
              title: btn.title || btn.getAttribute('title') || 'no-title',
              textContent: btn.textContent.trim().substring(0, 50),
              isVisible: btn.offsetParent !== null,
              display: styles.display,
              visibility: styles.visibility,
              opacity: styles.opacity,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              hasXIcon: btn.innerHTML.includes('X') || btn.innerHTML.includes('x') || 
                       btn.innerHTML.includes('trash') || btn.innerHTML.includes('Trash') ||
                       btn.innerHTML.includes('delete') || btn.innerHTML.includes('Delete'),
              innerHTML: btn.innerHTML.substring(0, 100)
            });
          });
          parent = parent.parentElement;
        }
      });
      
      // Also look for any buttons with delete-related content
      const allButtons = document.querySelectorAll('button');
      const deleteRelatedButtons = [];
      
      allButtons.forEach(btn => {
        const hasDeleteTitle = btn.title && (
          btn.title.includes('Delete') || btn.title.includes('delete') ||
          btn.title.includes('Remove') || btn.title.includes('remove') ||
          btn.title.includes('worktree')
        );
        
        const hasDeleteIcon = btn.innerHTML.includes('X') || btn.innerHTML.includes('Trash') ||
                             btn.innerHTML.includes('trash') || btn.className.includes('delete');
        
        if (hasDeleteTitle || hasDeleteIcon) {
          const rect = btn.getBoundingClientRect();
          const styles = window.getComputedStyle(btn);
          
          deleteRelatedButtons.push({
            title: btn.title || 'no-title',
            className: btn.className,
            isVisible: btn.offsetParent !== null,
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            innerHTML: btn.innerHTML.substring(0, 150)
          });
        }
      });
      
      analysis.deleteRelatedButtons = deleteRelatedButtons;
      
      return analysis;
    });
    
    console.log(`\\n🔍 BUTTON ANALYSIS RESULTS:`);
    console.log(`📊 V7 elements found: ${buttonAnalysis.v7ElementsFound}`);
    console.log(`🔘 Buttons near V7: ${buttonAnalysis.allButtonsNearV7.length}`);
    console.log(`🗑️ Delete-related buttons: ${buttonAnalysis.deleteRelatedButtons.length}`);
    
    // Show delete-related buttons
    console.log(`\\n🗑️ DELETE-RELATED BUTTONS:`);
    buttonAnalysis.deleteRelatedButtons.forEach((btn, i) => {
      console.log(`  Button ${i + 1}:`);
      console.log(`    Title: "${btn.title}"`);
      console.log(`    Class: "${btn.className}"`);
      console.log(`    Visible: ${btn.isVisible}`);
      console.log(`    Display: ${btn.display}`);
      console.log(`    Size: ${btn.width}x${btn.height}`);
      console.log(`    HTML: ${btn.innerHTML}`);
      console.log('');
    });
    
    // Show first few buttons near V7
    console.log(`\\n🔘 BUTTONS NEAR V7 (first 10):`);
    buttonAnalysis.allButtonsNearV7.slice(0, 10).forEach((btn, i) => {
      console.log(`  Button ${i + 1} (level ${btn.level}):`);
      console.log(`    Title: "${btn.title}"`);
      console.log(`    Class: "${btn.className}"`);
      console.log(`    Text: "${btn.textContent}"`);
      console.log(`    Visible: ${btn.isVisible}`);
      console.log(`    Display: ${btn.display}`);
      console.log(`    Size: ${btn.width}x${btn.height}`);
      console.log(`    Has X/Delete icon: ${btn.hasXIcon}`);
      console.log('');
    });
    
    // STEP 5: Test hover effects
    console.log('🖱️ Step 5: Testing hover effects on V7 elements...');
    
    const v7Elements = await page.locator('text=agendamente - V7').all();
    if (v7Elements.length > 0) {
      console.log('📍 Hovering over first V7 element...');
      await v7Elements[0].hover();
      await page.waitForTimeout(1000);
      
      // Check if buttons become visible on hover
      const afterHoverAnalysis = await page.evaluate(() => {
        const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.title && (
            btn.title.includes('Delete') || btn.title.includes('delete') ||
            btn.title.includes('Remove') || btn.title.includes('remove')
          )
        );
        
        return deleteButtons.map(btn => ({
          title: btn.title,
          isVisible: btn.offsetParent !== null,
          opacity: window.getComputedStyle(btn).opacity
        }));
      });
      
      console.log(`🖱️ After hover - visible delete buttons: ${afterHoverAnalysis.filter(b => b.isVisible).length}`);
      afterHoverAnalysis.forEach((btn, i) => {
        if (btn.isVisible) {
          console.log(`  Visible ${i + 1}: "${btn.title}" (opacity: ${btn.opacity})`);
        }
      });
    }
    
    // STEP 6: Take screenshot
    await page.screenshot({ path: 'test-results/delete-button-debug.png', fullPage: true });
    
    console.log('\\n🎯 DELETE BUTTON VISIBILITY DEBUG RESULTS:');
    console.log('==========================================');
    console.log(`📊 V7 worktree appears in UI: ${v7Count > 0 ? 'YES' : 'NO'}`);
    console.log(`🔘 Total buttons near V7: ${buttonAnalysis.allButtonsNearV7.length}`);
    console.log(`🗑️ Delete-related buttons found: ${buttonAnalysis.deleteRelatedButtons.length}`);
    console.log(`👁️ Visible delete buttons: ${buttonAnalysis.deleteRelatedButtons.filter(b => b.isVisible).length}`);
    
    if (buttonAnalysis.deleteRelatedButtons.length === 0) {
      console.log('\\n❌ ISSUE: No delete buttons found at all!');
      console.log('   This suggests the delete buttons are not being rendered');
    } else if (buttonAnalysis.deleteRelatedButtons.filter(b => b.isVisible).length === 0) {
      console.log('\\n❌ ISSUE: Delete buttons exist but are not visible!');
      console.log('   This suggests a CSS visibility problem');
    } else {
      console.log('\\n✅ Delete buttons are present and visible');
    }
    
    console.log('\\n✅ DELETE BUTTON DEBUG COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V7`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});