import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

test.describe('Comprehensive Concurrent Sessions Timing Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNzA2NjF9.iU9r62_XzdiMZFNlAfiRXGNg5vIpqdlUaHnzcdJQlzY';

  test('CRITICAL: Verify concurrent sessions with precise timing measurements', async ({ page }) => {
    console.log('🎯 CRITICAL TEST: Concurrent sessions with precise timing');
    
    // STEP 1: Setup multiple worktrees for testing
    console.log('🏗️ Step 1: Setting up test worktrees...');
    
    const versions = ['V5', 'V6', 'V7'];
    const worktreeResults = [];
    
    for (const version of versions) {
      // Clean existing
      await fetch(`http://localhost:3000/api/worktree/${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      
      // Create fresh worktree
      const createResponse = await fetch(`http://localhost:3000/api/worktree/create/${version}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: `feature/${version.toLowerCase()}-timing-test`,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        })
      });
      
      if (createResponse.ok) {
        console.log(`✅ Created worktree ${version}`);
        worktreeResults.push({ version, created: true });
      } else {
        console.log(`❌ Failed to create worktree ${version}`);
        worktreeResults.push({ version, created: false });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 2: Create multiple WebSocket connections directly
    console.log('🔗 Step 2: Creating direct WebSocket connections...');
    
    const connections = [];
    const connectionPromises = versions.map(async (version, index) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws?token=${AUTH_TOKEN}`);
        const connectionData = {
          version,
          index,
          ws,
          connected: false,
          responses: [],
          firstResponseTime: null,
          startTime: null
        };
        
        ws.on('open', () => {
          console.log(`🔗 WebSocket ${index + 1} (${version}) connected`);
          connectionData.connected = true;
          connections.push(connectionData);
          resolve(connectionData);
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          connectionData.responses.push({
            type: message.type,
            timestamp: Date.now(),
            data: message
          });
          
          // Record first meaningful response (when Claude starts processing)
          if (!connectionData.firstResponseTime && 
              (message.type === 'claude-response' || message.type === 'claude-output')) {
            connectionData.firstResponseTime = Date.now();
            console.log(`📥 First response from ${version} after ${connectionData.firstResponseTime - connectionData.startTime}ms`);
          }
        });
        
        ws.on('error', (error) => {
          console.error(`❌ WebSocket ${index + 1} (${version}) error:`, error);
          reject(error);
        });
        
        setTimeout(() => {
          if (!connectionData.connected) {
            reject(new Error(`Timeout connecting to ${version}`));
          }
        }, 10000);
      });
    });
    
    const establishedConnections = await Promise.allSettled(connectionPromises);
    const workingConnections = establishedConnections
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    console.log(`✅ Established ${workingConnections.length}/${versions.length} WebSocket connections`);
    
    if (workingConnections.length < 2) {
      throw new Error('Need at least 2 working connections to test concurrency');
    }
    
    // STEP 3: Send messages simultaneously and measure timing
    console.log('⚡ Step 3: Sending concurrent messages and measuring timing...');
    
    const globalStartTime = Date.now();
    const sendPromises = workingConnections.map(async (conn, index) => {
      const message = {
        type: 'claude-command',
        command: `Testing concurrent session ${index + 1} in ${conn.version}. Please respond with "Session ${index + 1} in ${conn.version} is working" and count to 5 slowly.`,
        options: {
          projectPath: `/Users/ggomes/.claude/projects/agendamente-${conn.version.toLowerCase()}`,
          projectName: `agendamente-${conn.version.toLowerCase()}`,
          cwd: `/Users/ggomes/IdeaProjects/agendamente-worktrees/${conn.version}`
        }
      };
      
      conn.startTime = Date.now();
      const offsetFromGlobal = conn.startTime - globalStartTime;
      
      console.log(`📤 Sending message to ${conn.version} (offset: ${offsetFromGlobal}ms)`);
      conn.ws.send(JSON.stringify(message));
      
      return {
        version: conn.version,
        startTime: conn.startTime,
        offsetFromGlobal
      };
    });
    
    const sendResults = await Promise.all(sendPromises);
    console.log(`⚡ All ${sendResults.length} messages sent within ${Date.now() - globalStartTime}ms`);
    
    // STEP 4: Wait for initial responses and measure concurrency
    console.log('👂 Step 4: Waiting for responses and measuring concurrency...');
    
    // Wait up to 15 seconds for first responses
    const responseTimeout = 15000;
    const responseStartTime = Date.now();
    
    while (Date.now() - responseStartTime < responseTimeout) {
      const respondedConnections = workingConnections.filter(conn => conn.firstResponseTime !== null);
      
      if (respondedConnections.length === workingConnections.length) {
        console.log('✅ All connections have received first responses');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // STEP 5: Analyze timing results
    console.log('\n🎯 CONCURRENT TIMING ANALYSIS:');
    console.log('==============================');
    
    const responseTimes = [];
    const startTimes = [];
    let concurrentBehavior = true;
    
    for (const conn of workingConnections) {
      const responseTime = conn.firstResponseTime ? conn.firstResponseTime - conn.startTime : -1;
      responseTimes.push(responseTime);
      startTimes.push(conn.startTime);
      
      console.log(`📊 ${conn.version}: Response after ${responseTime}ms (${responseTime > 0 ? 'SUCCESS' : 'NO RESPONSE'})`);
    }
    
    // Calculate timing metrics
    const validResponseTimes = responseTimes.filter(time => time > 0);
    const avgResponseTime = validResponseTimes.length > 0 ? 
      validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length : 0;
    const maxResponseTime = validResponseTimes.length > 0 ? Math.max(...validResponseTimes) : 0;
    const minResponseTime = validResponseTimes.length > 0 ? Math.min(...validResponseTimes) : 0;
    
    // Check if sessions started within a reasonable window (indicating concurrency)
    const maxStartTime = Math.max(...startTimes);
    const minStartTime = Math.min(...startTimes);
    const startTimeSpread = maxStartTime - minStartTime;
    
    console.log(`\n📈 TIMING METRICS:`);
    console.log(`⏱️ Message send spread: ${startTimeSpread}ms`);
    console.log(`⏱️ Average response time: ${Math.round(avgResponseTime)}ms`);
    console.log(`⏱️ Response time range: ${minResponseTime}ms - ${maxResponseTime}ms`);
    console.log(`📊 Successful responses: ${validResponseTimes.length}/${workingConnections.length}`);
    
    // STEP 6: Determine if behavior is truly concurrent
    const CONCURRENT_THRESHOLD = 2000; // If responses start within 2 seconds, likely concurrent
    
    if (validResponseTimes.length >= 2) {
      const responseSpread = maxResponseTime - minResponseTime;
      
      if (responseSpread < CONCURRENT_THRESHOLD) {
        console.log(`\n🎉 CONCURRENT BEHAVIOR DETECTED!`);
        console.log(`   ✅ Response spread (${responseSpread}ms) < threshold (${CONCURRENT_THRESHOLD}ms)`);
        console.log(`   ✅ Sessions appear to be processing in parallel`);
        concurrentBehavior = true;
      } else {
        console.log(`\n⚠️ SEQUENTIAL BEHAVIOR DETECTED!`);
        console.log(`   ❌ Response spread (${responseSpread}ms) > threshold (${CONCURRENT_THRESHOLD}ms)`);
        console.log(`   ❌ Sessions appear to be blocking each other`);
        concurrentBehavior = false;
      }
    } else {
      console.log(`\n❌ INSUFFICIENT DATA: Only ${validResponseTimes.length} sessions responded`);
      concurrentBehavior = false;
    }
    
    // STEP 7: Take screenshot for debugging
    await page.goto('http://localhost:3001');
    await page.screenshot({ path: 'test-results/concurrent-timing-analysis.png', fullPage: true });
    
    // STEP 8: Close connections and cleanup
    console.log('\n🧹 Cleaning up connections and worktrees...');
    
    for (const conn of workingConnections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
    }
    
    // Clean up test worktrees
    for (const version of versions) {
      await fetch(`http://localhost:3000/api/worktree/${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    // STEP 9: Final assessment
    console.log('\n🎯 FINAL CONCURRENT SESSIONS ASSESSMENT:');
    console.log('========================================');
    
    if (concurrentBehavior && validResponseTimes.length >= 2) {
      console.log('✅ SUCCESS: Concurrent sessions are working!');
      console.log('   ✅ Multiple sessions process simultaneously');
      console.log('   ✅ No blocking behavior detected');
      console.log('   ✅ Response times indicate parallel processing');
    } else if (validResponseTimes.length >= 2) {
      console.log('❌ FAILURE: Sessions appear to be blocking each other');
      console.log('   ❌ Sequential processing detected');
      console.log('   ❌ Need to investigate WebSocket handling');
    } else {
      console.log('❌ FAILURE: Insufficient session responses');
      console.log('   ❌ Sessions may not be starting properly');
      console.log('   ❌ Need to investigate session creation');
    }
    
    console.log('\n✅ COMPREHENSIVE CONCURRENT TIMING TEST COMPLETE');
    
    // Fail the test if concurrent behavior is not detected
    expect(concurrentBehavior).toBe(true);
    expect(validResponseTimes.length).toBeGreaterThanOrEqual(2);
  });
});