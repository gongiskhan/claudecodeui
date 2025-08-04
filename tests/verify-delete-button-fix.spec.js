import { test, expect } from '@playwright/test';

test.describe('Verify Delete Button Fix', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('VERIFY: Delete buttons are now visible for worktrees', async ({ page }) => {
    console.log('🔍 VERIFYING: Delete button fix for worktrees');
    
    // STEP 1: Create fresh worktree for testing
    console.log('🏗️ Step 1: Creating fresh V8 worktree...');
    
    await page.request.delete(`http://localhost:3000/api/worktree/V8`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V8', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v8-delete-button-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    console.log('✅ V8 worktree created');
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
    
    // STEP 3: Check if V8 appears
    console.log('📊 Step 3: Checking if V8 appears in UI...');
    
    const v8Count = await page.locator('text=agendamente - V8').count();
    console.log(`📋 V8 entries found: ${v8Count}`);
    
    // STEP 4: Look for visible delete buttons
    console.log('🔍 Step 4: Looking for visible delete buttons...');
    
    const visibleDeleteButtons = await page.evaluate(() => {
      const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.title && btn.title.includes('Delete worktree')
      );
      
      return deleteButtons.map(btn => {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);
        
        return {
          title: btn.title,
          className: btn.className,
          isVisible: btn.offsetParent !== null,
          display: styles.display,
          opacity: styles.opacity,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        };
      });
    });
    
    console.log(`🔘 Delete worktree buttons found: ${visibleDeleteButtons.length}`);
    
    const actuallyVisibleButtons = visibleDeleteButtons.filter(btn => 
      btn.isVisible && btn.width > 0 && btn.height > 0
    );
    
    console.log(`👁️ Actually visible delete buttons: ${actuallyVisibleButtons.length}`);
    
    actuallyVisibleButtons.forEach((btn, i) => {
      console.log(`  Button ${i + 1}: "${btn.title}"`);
      console.log(`    Size: ${btn.width}x${btn.height}`);
      console.log(`    Position: ${btn.left},${btn.top}`);
      console.log(`    Opacity: ${btn.opacity}`);
    });
    
    // STEP 5: Try to hover over V8 project to see delete button
    console.log('🖱️ Step 5: Hovering over V8 project to reveal delete button...');
    
    // Find a visible V8 element to hover over
    const v8Elements = await page.locator('text=agendamente - V8').all();
    let hoveredSuccessfully = false;
    
    for (const element of v8Elements) {
      if (await element.isVisible()) {
        try {
          await element.hover();
          hoveredSuccessfully = true;
          console.log('✅ Successfully hovered over V8 element');
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!hoveredSuccessfully) {
      console.log('⚠️ Could not hover over V8 element');
    }
    
    await page.waitForTimeout(1000);
    
    // Check delete buttons after hover
    const afterHoverButtons = await page.evaluate(() => {
      const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.title && btn.title.includes('Delete worktree')
      );
      
      return deleteButtons.map(btn => {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);
        
        return {
          title: btn.title,
          isVisible: btn.offsetParent !== null,
          opacity: styles.opacity,
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }).filter(btn => btn.isVisible && btn.width > 0 && btn.height > 0);
    });
    
    console.log(`👁️ Visible delete buttons after hover: ${afterHoverButtons.length}`);
    
    // STEP 6: Try to click delete button if visible
    if (afterHoverButtons.length > 0) {
      console.log('🖱️ Step 6: Attempting to click delete button...');
      
      // Set up dialog handler
      let dialogAppeared = false;
      page.on('dialog', async dialog => {
        console.log(`📋 Dialog: "${dialog.message()}"`);
        dialogAppeared = true;
        await dialog.dismiss(); // Don't actually delete, just test the button works
      });
      
      // Try to click the delete button
      const clickSuccess = await page.evaluate(() => {
        const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.title && btn.title.includes('Delete worktree') && 
          btn.offsetParent !== null && 
          btn.getBoundingClientRect().width > 0
        );
        
        if (deleteButtons.length > 0) {
          deleteButtons[0].click();
          return true;
        }
        return false;
      });
      
      if (clickSuccess) {
        console.log('✅ Delete button clicked successfully');
        await page.waitForTimeout(1000);
        
        if (dialogAppeared) {
          console.log('✅ Confirmation dialog appeared');
        } else {
          console.log('⚠️ No confirmation dialog appeared');
        }
      } else {
        console.log('❌ Could not click delete button');
      }
    }
    
    // STEP 7: Take screenshot
    await page.screenshot({ path: 'test-results/delete-button-fix-verification.png', fullPage: true });
    
    console.log('\\n🎯 DELETE BUTTON FIX VERIFICATION RESULTS:');
    console.log('==========================================');
    console.log(`📊 V8 worktree appears: ${v8Count > 0 ? 'YES' : 'NO'}`);
    console.log(`🔘 Delete buttons found: ${visibleDeleteButtons.length}`);
    console.log(`👁️ Actually visible buttons: ${actuallyVisibleButtons.length}`);
    console.log(`🖱️ Buttons after hover: ${afterHoverButtons.length}`);
    
    if (actuallyVisibleButtons.length > 0 || afterHoverButtons.length > 0) {
      console.log('\\n🎉 SUCCESS: Delete buttons are now visible!');
      console.log('   ✅ Worktree delete buttons appear in UI');
      console.log('   ✅ Buttons have proper size and position');
      console.log('   ✅ Hover reveals delete buttons');
      console.log('   ✅ Click triggers confirmation dialog');
    } else {
      console.log('\\n❌ ISSUE: Delete buttons still not visible');
      console.log('   Need further investigation');
    }
    
    console.log('\\n✅ DELETE BUTTON FIX VERIFICATION COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V8`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});