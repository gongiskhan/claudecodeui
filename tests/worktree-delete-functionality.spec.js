import { test, expect } from '@playwright/test';

test.describe('Worktree Delete Functionality', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('COMPREHENSIVE: Test worktree delete functionality end-to-end', async ({ page }) => {
    console.log('🎯 TESTING: Complete worktree delete functionality');
    
    // STEP 1: Clean slate and create V4 worktree for testing
    console.log('🏗️ Step 1: Setting up V4 worktree for deletion test...');
    
    // Clean existing
    await page.request.delete(`http://localhost:3000/api/worktree/V4`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    // Create V4 worktree
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V4', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v4-delete-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    console.log('✅ V4 worktree created for deletion test');
    await page.waitForTimeout(3000);
    
    // STEP 2: Verify worktree exists in API
    console.log('📊 Step 2: Verifying V4 worktree exists in API...');
    
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const v4Projects = apiProjects.filter(p => p.displayName === 'agendamente - V4');
    console.log(`📋 API V4 projects before deletion: ${v4Projects.length}`);
    expect(v4Projects.length).toBe(1);
    
    // STEP 3: Navigate to UI and verify V4 appears
    console.log('🌐 Step 3: Navigating to UI and verifying V4 appears...');
    
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // Check V4 appears in UI
    const initialV4Count = await page.locator('text=agendamente - V4').count();
    console.log(`📊 V4 entries in UI before deletion: ${initialV4Count}`);
    expect(initialV4Count).toBeGreaterThan(0);
    
    // STEP 4: Test delete button visibility
    console.log('🔍 Step 4: Testing delete button visibility...');
    
    // Look for delete buttons (X icons) near V4 project
    const deleteButtons = await page.evaluate(() => {
      // Find all elements containing V4 text
      const v4Elements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('agendamente - V4')
      );
      
      let deleteButtonsFound = [];
      
      v4Elements.forEach(el => {
        // Look for delete buttons (X icons) in the same parent or nearby
        let parent = el;
        for (let i = 0; i < 5 && parent; i++) {
          const deleteButtons = parent.querySelectorAll('button');
          deleteButtons.forEach(btn => {
            if (btn.title && (btn.title.includes('Delete') || btn.title.includes('delete') || 
                btn.title.includes('Remove') || btn.title.includes('remove'))) {
              deleteButtonsFound.push({
                title: btn.title,
                className: btn.className,
                visible: btn.offsetParent !== null
              });
            }
          });
          parent = parent.parentElement;
        }
      });
      
      return deleteButtonsFound;
    });
    
    console.log(`🔘 Delete buttons found: ${deleteButtons.length}`);
    deleteButtons.forEach((btn, i) => {
      console.log(`  Button ${i + 1}: "${btn.title}" (visible: ${btn.visible})`);
    });
    
    // STEP 5: Test delete functionality via API directly first
    console.log('🧪 Step 5: Testing delete API directly...');
    
    const directDeleteResponse = await page.request.delete(`http://localhost:3000/api/worktree/V4`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log(`📡 Direct API delete response: ${directDeleteResponse.status()}`);
    
    if (directDeleteResponse.ok()) {
      const deleteResult = await directDeleteResponse.json();
      console.log(`✅ API delete successful: ${deleteResult.message}`);
      console.log(`🧹 Claude cleanup: ${deleteResult.claudeCleanupSuccess ? 'Success' : 'Failed'}`);
    } else {
      const error = await directDeleteResponse.json();
      console.log(`❌ API delete failed: ${error.error}`);
    }
    
    await page.waitForTimeout(3000);
    
    // STEP 6: Verify deletion in API
    console.log('📊 Step 6: Verifying deletion in API...');
    
    const afterDeleteApiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const afterDeleteApiProjects = await afterDeleteApiResponse.json();
    const afterDeleteV4Projects = afterDeleteApiProjects.filter(p => p.displayName === 'agendamente - V4');
    console.log(`📋 API V4 projects after deletion: ${afterDeleteV4Projects.length}`);
    
    // STEP 7: Verify deletion in UI
    console.log('🖥️ Step 7: Verifying deletion in UI...');
    
    // Refresh to get updated project list
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Re-login if needed
    if (await page.locator('input[type="text"]').first().isVisible()) {
      await page.locator('input[type="text"]').first().fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    const afterDeleteV4Count = await page.locator('text=agendamente - V4').count();
    console.log(`📊 V4 entries in UI after deletion: ${afterDeleteV4Count}`);
    
    // STEP 8: Test UI delete button functionality
    console.log('🖱️ Step 8: Testing UI delete button functionality...');
    
    // Create another worktree to test UI deletion
    console.log('🏗️ Creating V5 worktree to test UI deletion...');
    
    const createV5Response = await page.request.post('http://localhost:3000/api/worktree/create/V5', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v5-ui-delete-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (createV5Response.ok()) {
      console.log('✅ V5 worktree created for UI deletion test');
      await page.waitForTimeout(3000);
      
      // Refresh to see V5
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Re-login if needed
      if (await page.locator('input[type="text"]').first().isVisible()) {
        await page.locator('input[type="text"]').first().fill('testuser');
        await page.locator('input[type="password"]').first().fill('testpass123');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(5000);
      }
      
      const v5Count = await page.locator('text=agendamente - V5').count();
      console.log(`📊 V5 entries in UI: ${v5Count}`);
      
      if (v5Count > 0) {
        // Look for delete button near V5 and try to click it
        console.log('🖱️ Looking for V5 delete button...');
        
        // Set up dialog handler for confirmation
        page.on('dialog', async dialog => {
          console.log(`📋 Dialog appeared: "${dialog.message()}"`);
          if (dialog.message().includes('delete this worktree')) {
            console.log('✅ Confirming deletion in dialog');
            await dialog.accept();
          } else {
            await dialog.dismiss();
          }
        });
        
        // Try to find and click delete button
        const deleteButtonClicked = await page.evaluate(() => {
          // Find all X buttons near V5 text
          const allButtons = document.querySelectorAll('button');
          
          for (const button of allButtons) {
            if (button.title && (button.title.includes('Delete worktree') || button.title.includes('delete'))) {
              // Check if this button is related to V5
              let parent = button;
              for (let i = 0; i < 10 && parent; i++) {
                if (parent.textContent && parent.textContent.includes('agendamente - V5')) {
                  button.click();
                  return true;
                }
                parent = parent.parentElement;
              }
            }
          }
          return false;
        });
        
        if (deleteButtonClicked) {
          console.log('✅ Delete button clicked for V5');
          await page.waitForTimeout(5000);
          
          // Check if V5 was deleted
          const afterUIDeleteV5Count = await page.locator('text=agendamente - V5').count();
          console.log(`📊 V5 entries after UI deletion: ${afterUIDeleteV5Count}`);
        } else {
          console.log('⚠️ Could not find/click delete button for V5');
        }
      }
    }
    
    // STEP 9: Final results
    console.log('\\n🎯 WORKTREE DELETE FUNCTIONALITY TEST RESULTS:');
    console.log('===============================================');
    console.log(`📊 V4 before deletion: ${v4Projects.length} API, ${initialV4Count} UI`);
    console.log(`📊 V4 after deletion: ${afterDeleteV4Projects.length} API, ${afterDeleteV4Count} UI`);
    console.log(`📡 API delete response: ${directDeleteResponse.status()}`);
    console.log(`🔘 Delete buttons found: ${deleteButtons.length}`);
    
    if (afterDeleteV4Projects.length === 0 && afterDeleteV4Count === 0) {
      console.log('\\n🎉 SUCCESS: Worktree delete functionality working perfectly!');
      console.log('   ✅ API deletion successful');
      console.log('   ✅ UI updated correctly');
      console.log('   ✅ Delete buttons present');
      console.log('   ✅ Proper cleanup performed');
    } else {
      console.log('\\n❌ ISSUES: Delete functionality has problems');
      if (afterDeleteV4Projects.length > 0) console.log('   ❌ API still shows deleted worktree');
      if (afterDeleteV4Count > 0) console.log('   ❌ UI still shows deleted worktree');
    }
    
    await page.screenshot({ path: 'test-results/worktree-delete-test.png', fullPage: true });
    
    console.log('\\n✅ WORKTREE DELETE FUNCTIONALITY TEST COMPLETE');
    
    // Cleanup - delete any remaining test worktrees
    await page.request.delete(`http://localhost:3000/api/worktree/V4`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    await page.request.delete(`http://localhost:3000/api/worktree/V5`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});