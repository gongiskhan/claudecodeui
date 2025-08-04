import { test, expect } from '@playwright/test';

test.describe('WebSocket Duplication Debug', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DEBUG: Monitor WebSocket messages during duplication', async ({ page }) => {
    console.log('🔍 DEBUG: Monitoring WebSocket messages for duplication patterns');
    
    // Capture WebSocket messages
    const wsMessages = [];
    
    page.on('websocket', ws => {
      console.log('🔗 WebSocket connection established');
      
      ws.on('framereceived', event => {
        try {
          const message = JSON.parse(event.payload);
          wsMessages.push({
            timestamp: new Date().toISOString(),
            type: message.type,
            message: message
          });
          
          if (message.type === 'projects_updated') {
            const v3Projects = message.projects?.filter(p => p.displayName === 'agendamente - V3') || [];
            console.log(`📡 WebSocket projects_updated: ${v3Projects.length} V3 projects`);
          }
        } catch (e) {
          // Non-JSON messages
        }
      });
      
      ws.on('framesent', event => {
        try {
          const message = JSON.parse(event.payload);
          if (message.type === 'spawn') {
            console.log('📤 WebSocket send: spawn message');
          }
        } catch (e) {
          // Non-JSON messages
        }
      });
    });
    
    // STEP 1: Clean and create V3 worktree
    console.log('🧹 Step 1: Cleaning and creating V3 worktree...');
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-websocket-debug',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    await page.waitForTimeout(3000);
    
    // STEP 2: Verify API has exactly 1 V3 project
    const apiResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const apiProjects = await apiResponse.json();
    const v3Count = apiProjects.filter(p => p.displayName === 'agendamente - V3').length;
    console.log(`📊 API V3 projects: ${v3Count}`);
    expect(v3Count).toBe(1);
    
    // STEP 3: Navigate to UI and login
    console.log('🌐 Step 3: Navigating to UI...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);
    
    const usernameField = page.locator('input[type="text"]').first();
    if (await usernameField.isVisible()) {
      await usernameField.fill('testuser');
      await page.locator('input[type="password"]').first().fill('testpass123');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }
    
    // STEP 4: Check initial state
    console.log('📊 Step 4: Checking initial UI state...');
    
    const initialV3Count = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      let count = 0;
      for (let element of allElements) {
        if (element.textContent && element.textContent.includes('agendamente - V3')) {
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
            child.textContent && child.textContent.includes('agendamente - V3')
          );
          if (isVisible && !hasTextChildren) count++;
        }
      }
      return count;
    });
    
    console.log(`📊 Initial V3 count in UI: ${initialV3Count}`);
    
    // STEP 5: Simulate the exact user action that causes duplication
    console.log('🎯 Step 5: Simulating user action that triggers duplication...');
    
    // Click on V3 project to select it (if visible)
    const v3ProjectElements = await page.locator('text=agendamente - V3').all();
    console.log(`🔍 Found ${v3ProjectElements.length} V3 project elements`);
    
    // Find a clickable V3 element
    let clickableV3Element = null;
    for (const element of v3ProjectElements) {
      if (await element.isVisible()) {
        try {
          await element.click({ timeout: 1000 });
          console.log('✅ Successfully clicked V3 project');
          clickableV3Element = element;
          break;
        } catch (e) {
          console.log('⚠️ Element not clickable, trying next...');
          continue;
        }
      }
    }
    
    if (!clickableV3Element) {
      console.log('❌ Could not find clickable V3 element');
      await page.screenshot({ path: 'test-results/no-clickable-v3.png', fullPage: true });
      // Create a new session anyway to test the duplication
      const newSessionButton = page.locator('text=New Session').first();
      if (await newSessionButton.isVisible()) {
        await newSessionButton.click();
        console.log('✅ Created new session via New Session button');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // STEP 6: Monitor during message send (critical point)
    console.log('💬 Step 6: Sending message and monitoring for duplication...');
    
    // Clear previous WebSocket messages
    wsMessages.length = 0;
    
    // Try to find message input (could be in different locations)
    const messageSelectors = [
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]', 
      'input[placeholder*="message"]',
      'textarea',
      '[contenteditable="true"]'
    ];
    
    let messageInput = null;
    for (const selector of messageSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        messageInput = element;
        console.log(`✅ Found message input: ${selector}`);
        break;
      }
    }
    
    if (messageInput) {
      // Send a test message
      await messageInput.fill('test message to trigger duplication bug');
      
      // Try to find send button
      const sendSelectors = [
        'button:has-text("Send")',
        'button[type="submit"]',
        'button:has([data-icon="send"])',
        'button:has(svg)'
      ];
      
      let sendButton = null;
      for (const selector of sendSelectors) {
        const element = page.locator(selector).last(); // Use last to get the most likely send button
        if (await element.isVisible()) {
          sendButton = element;
          console.log(`✅ Found send button: ${selector}`);
          break;
        }
      }
      
      if (sendButton) {
        console.log('📤 Sending message via button...');
        await sendButton.click();
      } else {
        console.log('📤 Sending message via Enter key...');
        await messageInput.press('Enter');
      }
      
      // Wait for WebSocket activity and file system changes
      await page.waitForTimeout(5000);
      
    } else {
      console.log('❌ Could not find message input');
      await page.screenshot({ path: 'test-results/no-message-input.png', fullPage: true });
    }
    
    // STEP 7: Monitor V3 count changes over time
    console.log('📊 Step 7: Monitoring V3 count changes...');
    
    const v3Counts = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      
      const currentV3Count = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        let count = 0;
        for (let element of allElements) {
          if (element.textContent && element.textContent.includes('agendamente - V3')) {
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
              child.textContent && child.textContent.includes('agendamente - V3')
            );
            if (isVisible && !hasTextChildren) count++;
          }
        }
        return count;
      });
      
      v3Counts.push({ time: i, count: currentV3Count });
      console.log(`📊 Time ${i}s: ${currentV3Count} V3 entries`);
    }
    
    // STEP 8: Final analysis
    console.log('\\n🎯 WEBSOCKET DUPLICATION DEBUG RESULTS:');
    console.log('=======================================');
    console.log(`📊 Initial V3 count: ${initialV3Count}`);
    console.log(`📊 V3 counts over time: ${v3Counts.map(c => `${c.time}s:${c.count}`).join(', ')}`);
    console.log(`📡 Total WebSocket messages captured: ${wsMessages.length}`);
    
    // Analyze WebSocket messages
    const projectsUpdatedMessages = wsMessages.filter(m => m.type === 'projects_updated');
    console.log(`📡 projects_updated messages: ${projectsUpdatedMessages.length}`);
    
    projectsUpdatedMessages.forEach((msg, i) => {
      const v3Projects = msg.message.projects?.filter(p => p.displayName === 'agendamente - V3') || [];
      console.log(`  Message ${i + 1}: ${v3Projects.length} V3 projects at ${msg.timestamp}`);
    });
    
    // Check for duplication pattern
    const maxV3Count = Math.max(...v3Counts.map(c => c.count));
    if (maxV3Count > 1) {
      console.log('🚨 DUPLICATION DETECTED: V3 count exceeded 1 during test');
    } else {
      console.log('✅ NO DUPLICATION: V3 count remained at 1 throughout test');
    }
    
    await page.screenshot({ path: 'test-results/websocket-debug-final.png', fullPage: true });
    
    console.log('✅ WEBSOCKET DUPLICATION DEBUG COMPLETE');
    
    // Cleanup
    await page.request.delete(`http://localhost:3000/api/worktree/V3`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
  });
});