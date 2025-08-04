import { test, expect } from '@playwright/test';

test.describe('Real-World Worktree Concurrent Processing Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNzA2NjF9.iU9r62_XzdiMZFNlAfiRXGNg5vIpqdlUaHnzcdJQlzY';

  test('REAL-WORLD: Multiple worktrees processing simultaneously like actual user workflow', async ({ browser }) => {
    console.log('🌍 REAL-WORLD TEST: Multiple worktrees concurrent processing');
    
    // STEP 1: Create realistic worktree scenario
    console.log('🏗️ Step 1: Setting up realistic worktree development scenario...');
    
    const worktreeScenarios = [
      {
        version: 'V2', 
        task: 'Add user authentication feature',
        branch: 'feature/v2-auth'
      },
      {
        version: 'V3', 
        task: 'Implement dark mode toggle',
        branch: 'feature/v3-dark-mode'
      },
      {
        version: 'V4', 
        task: 'Fix responsive layout bugs',
        branch: 'feature/v4-responsive-fixes'
      }
    ];
    
    // Clean and create worktrees
    for (const scenario of worktreeScenarios) {
      await fetch(`http://localhost:3000/api/worktree/${scenario.version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      
      const createResponse = await fetch(`http://localhost:3000/api/worktree/create/${scenario.version}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: scenario.branch,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        })
      });
      
      if (createResponse.ok) {
        console.log(`✅ Created ${scenario.version} worktree for: ${scenario.task}`);
      } else {
        console.log(`❌ Failed to create ${scenario.version} worktree`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // STEP 2: Open multiple browser tabs simulating real user workflow
    console.log('🖥️ Step 2: Opening multiple browser tabs (simulating real user)...');
    
    const contexts = [];
    const pages = [];
    const sessionStates = [];
    
    for (let i = 0; i < worktreeScenarios.length; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      contexts.push(context);
      pages.push(page);
      sessionStates.push({
        version: worktreeScenarios[i].version,
        task: worktreeScenarios[i].task,
        page,
        messageStartTime: null,
        firstResponseTime: null,
        isProcessing: false,
        responses: []
      });
    }
    
    // STEP 3: Log into all tabs
    console.log('🔐 Step 3: Logging into all tabs...');
    
    const loginPromises = pages.map(async (page, index) => {
      await page.goto('http://localhost:3001');
      await page.waitForTimeout(2000);
      
      const usernameField = page.locator('input[type="text"]').first();
      if (await usernameField.isVisible()) {
        await usernameField.fill('testuser');
        await page.locator('input[type="password"]').first().fill('testpass123');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
        console.log(`✅ Tab ${index + 1} (${worktreeScenarios[index].version}) logged in`);
      }
      
      return { tabIndex: index + 1, success: true };
    });
    
    await Promise.all(loginPromises);
    
    // STEP 4: Select different worktrees in each tab
    console.log('🌳 Step 4: Selecting different worktrees in each tab...');
    
    const worktreeSelectionPromises = sessionStates.map(async (state, index) => {
      try {
        // Click on the specific worktree project
        const worktreeProject = state.page.locator(`text=agendamente - ${state.version}`).first();
        if (await worktreeProject.isVisible()) {
          await worktreeProject.click();
          await state.page.waitForTimeout(1000);
          console.log(`✅ Tab ${index + 1}: Selected ${state.version} worktree`);
        } else {
          console.log(`❌ Tab ${index + 1}: Could not find ${state.version} worktree`);
          return false;
        }
        
        // Start new session
        const newSessionButton = state.page.locator('text=New Session').first();
        if (await newSessionButton.isVisible()) {
          await newSessionButton.click();
          await state.page.waitForTimeout(2000);
          console.log(`✅ Tab ${index + 1}: Started new session in ${state.version}`);
        }
        
        return true;
      } catch (error) {
        console.log(`❌ Tab ${index + 1}: Failed to select worktree - ${error.message}`);
        return false;
      }
    });
    
    const selectionResults = await Promise.all(worktreeSelectionPromises);
    const workingTabs = selectionResults.filter(result => result === true).length;
    console.log(`✅ ${workingTabs}/${sessionStates.length} tabs have working worktree sessions`);
    
    // STEP 5: Send realistic development messages simultaneously
    console.log('💻 Step 5: Sending realistic development tasks simultaneously...');
    
    const globalStartTime = Date.now();
    
    const messagePromises = sessionStates.map(async (state, index) => {
      try {
        const messageInput = state.page.locator('textarea').first();
        if (await messageInput.isVisible()) {
          const developmentMessage = `I'm working on ${state.task} in the ${state.version} version. Please help me analyze the current codebase structure and suggest the best approach for implementing this feature. Take your time to provide a detailed response.`;
          
          await messageInput.fill(developmentMessage);
          
          const sendButton = state.page.locator('button[type="submit"]').last();
          if (await sendButton.isVisible()) {
            state.messageStartTime = Date.now();
            const offsetFromGlobal = state.messageStartTime - globalStartTime;
            
            await sendButton.click();
            state.isProcessing = true;
            
            console.log(`📤 Tab ${index + 1} (${state.version}): Sent development message (offset: ${offsetFromGlobal}ms)`);
            console.log(`   Task: ${state.task}`);
            
            return { 
              tabIndex: index + 1, 
              version: state.version, 
              startTime: state.messageStartTime,
              offset: offsetFromGlobal,
              success: true 
            };
          }
        }
        
        return { tabIndex: index + 1, version: state.version, success: false };
      } catch (error) {
        console.log(`❌ Tab ${index + 1} (${state.version}): Failed to send message - ${error.message}`);
        return { tabIndex: index + 1, version: state.version, success: false, error: error.message };
      }
    });
    
    const messageResults = await Promise.all(messagePromises);
    const successfulMessages = messageResults.filter(result => result.success);
    
    console.log(`⚡ ${successfulMessages.length} messages sent within ${Date.now() - globalStartTime}ms`);
    
    // STEP 6: Monitor for responses and detect processing patterns
    console.log('👀 Step 6: Monitoring responses to detect concurrent vs sequential processing...');
    
    const monitoringTimeout = 20000; // 20 seconds
    const monitoringStartTime = Date.now();
    const responseDetectionPromises = sessionStates.map(async (state, index) => {
      const tabStartTime = Date.now();
      
      try {
        // Wait for any sign that Claude is responding
        await state.page.waitForSelector('.claude-message, [class*="claude"], [class*="processing"], text=Claude', {
          timeout: monitoringTimeout
        });
        
        state.firstResponseTime = Date.now();
        const responseDelay = state.firstResponseTime - state.messageStartTime;
        
        console.log(`📥 Tab ${index + 1} (${state.version}): Response detected after ${responseDelay}ms`);
        
        return {
          tabIndex: index + 1,
          version: state.version,
          responseTime: responseDelay,
          success: true
        };
        
      } catch (error) {
        console.log(`⚠️ Tab ${index + 1} (${state.version}): No response detected within ${monitoringTimeout}ms`);
        
        return {
          tabIndex: index + 1,
          version: state.version,
          responseTime: -1,
          success: false
        };
      }
    });
    
    const responseResults = await Promise.allSettled(responseDetectionPromises);
    
    // STEP 7: Analyze real-world concurrent processing results
    console.log('\n🌍 REAL-WORLD CONCURRENT PROCESSING ANALYSIS:');
    console.log('=============================================');
    
    const successfulResponses = [];
    const failedResponses = [];
    
    responseResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successfulResponses.push(result.value);
        console.log(`✅ ${result.value.version}: Response after ${result.value.responseTime}ms`);
      } else {
        const version = sessionStates[index].version;
        failedResponses.push({ version, tabIndex: index + 1 });
        console.log(`❌ ${version}: No response detected`);
      }
    });
    
    // Analyze timing patterns
    if (successfulResponses.length >= 2) {
      const responseTimes = successfulResponses.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const responseSpread = maxResponseTime - minResponseTime;
      
      console.log(`\n📊 REAL-WORLD PERFORMANCE METRICS:`);
      console.log(`⏱️ Successful sessions: ${successfulResponses.length}/${sessionStates.length}`);
      console.log(`⏱️ Average response time: ${Math.round(avgResponseTime)}ms`);
      console.log(`⏱️ Response time range: ${minResponseTime}ms - ${maxResponseTime}ms`);
      console.log(`⏱️ Response spread: ${responseSpread}ms`);
      
      // Determine if truly concurrent (responses should start within reasonable window)
      const CONCURRENT_THRESHOLD = 3000; // 3 seconds for real development tasks
      
      if (responseSpread < CONCURRENT_THRESHOLD) {
        console.log(`\n🎉 REAL-WORLD CONCURRENT SUCCESS!`);
        console.log(`   ✅ Multiple worktrees processing simultaneously`);
        console.log(`   ✅ No blocking between different development tasks`);
        console.log(`   ✅ User can work on V2, V3, V4 features in parallel`);
        console.log(`   ✅ Response spread (${responseSpread}ms) indicates parallel processing`);
      } else {
        console.log(`\n❌ REAL-WORLD SEQUENTIAL BEHAVIOR DETECTED!`);
        console.log(`   ❌ Worktrees appear to be blocking each other`);
        console.log(`   ❌ Response spread (${responseSpread}ms) > threshold (${CONCURRENT_THRESHOLD}ms)`);
        console.log(`   ❌ User cannot effectively work on multiple versions simultaneously`);
      }
    } else {
      console.log(`\n❌ INSUFFICIENT REAL-WORLD DATA: Only ${successfulResponses.length} sessions responded`);
    }
    
    // STEP 8: Take screenshots of all tabs
    console.log('\n📸 Step 8: Taking screenshots of all development sessions...');
    
    for (let i = 0; i < pages.length; i++) {
      await pages[i].screenshot({ 
        path: `test-results/real-world-${sessionStates[i].version}-development.png`, 
        fullPage: true 
      });
    }
    
    // STEP 9: Cleanup
    console.log('\n🧹 Step 9: Cleaning up development session...');
    
    for (const context of contexts) {
      await context.close();
    }
    
    // Clean up test worktrees
    for (const scenario of worktreeScenarios) {
      await fetch(`http://localhost:3000/api/worktree/${scenario.version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    // STEP 10: Final real-world assessment
    console.log('\n🌍 FINAL REAL-WORLD WORKTREE ASSESSMENT:');
    console.log('========================================');
    
    const concurrentWorkflow = successfulResponses.length >= 2 && 
      Math.max(...successfulResponses.map(r => r.responseTime)) - 
      Math.min(...successfulResponses.map(r => r.responseTime)) < 3000;
    
    if (concurrentWorkflow) {
      console.log('✅ SUCCESS: Real-world concurrent worktree development works!');
      console.log('   ✅ Multiple versions can be developed simultaneously');
      console.log('   ✅ No blocking between worktree sessions');
      console.log('   ✅ User can work on V2 auth, V3 dark mode, V4 responsive fixes in parallel');
      console.log('   ✅ Development workflow is efficient and practical');
    } else {
      console.log('❌ FAILURE: Real-world concurrent development not working');
      console.log('   ❌ Worktrees are blocking each other');
      console.log('   ❌ User cannot efficiently develop multiple features simultaneously');
      console.log('   ❌ The main value proposition of worktrees is compromised');
    }
    
    console.log('\n✅ REAL-WORLD WORKTREE CONCURRENT TEST COMPLETE');
    
    // Fail the test if concurrent workflow is not working
    expect(concurrentWorkflow).toBe(true);
    expect(successfulResponses.length).toBeGreaterThanOrEqual(2);
  });
});