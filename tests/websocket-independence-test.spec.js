import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

test.describe('WebSocket Independence Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNzA2NjF9.iU9r62_XzdiMZFNlAfiRXGNg5vIpqdlUaHnzcdJQlzY';

  test('CRITICAL: WebSocket message handling independence verification', async ({ page }) => {
    console.log('🔌 CRITICAL TEST: WebSocket message handling independence');
    
    // STEP 1: Create test worktrees
    console.log('🏗️ Step 1: Setting up test worktrees...');
    
    const testVersions = ['W1', 'W2', 'W3'];
    
    for (const version of testVersions) {
      await fetch(`http://localhost:3000/api/worktree/${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      
      const createResponse = await fetch(`http://localhost:3000/api/worktree/create/${version}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: `feature/${version.toLowerCase()}-websocket-test`,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        })
      });
      
      if (createResponse.ok) {
        console.log(`✅ Created worktree ${version}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 2: Create multiple independent WebSocket connections
    console.log('🔗 Step 2: Creating independent WebSocket connections...');
    
    const websockets = [];
    const connectionData = [];
    
    const createWebSocketConnection = (version, index) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws?token=${AUTH_TOKEN}`);
        const data = {
          version,
          index,
          ws,
          connected: false,
          messagesSent: [],
          responsesReceived: [],
          messageHandlingTimes: [],
          blockingDetected: false
        };
        
        ws.on('open', () => {
          console.log(`🔗 WebSocket ${index} (${version}) connected`);
          data.connected = true;
          websockets.push(ws);
          connectionData.push(data);
          resolve(data);
        });
        
        ws.on('message', (rawMessage) => {
          const receiveTime = Date.now();
          const message = JSON.parse(rawMessage.toString());
          
          data.responsesReceived.push({
            type: message.type,
            timestamp: receiveTime,
            data: message
          });
          
          console.log(`📥 WS${index} (${version}): Received ${message.type} at ${receiveTime}`);
        });
        
        ws.on('error', (error) => {
          console.error(`❌ WebSocket ${index} (${version}) error:`, error);
          reject(error);
        });
        
        setTimeout(() => {
          if (!data.connected) {
            reject(new Error(`WebSocket ${index} (${version}) connection timeout`));
          }
        }, 10000);
      });
    };
    
    // Create all WebSocket connections in parallel
    const connectionPromises = testVersions.map((version, index) => 
      createWebSocketConnection(version, index + 1)
    );
    
    const connections = await Promise.allSettled(connectionPromises);
    const workingConnections = connections
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    console.log(`✅ Created ${workingConnections.length}/${testVersions.length} WebSocket connections`);
    
    if (workingConnections.length < 2) {
      throw new Error('Need at least 2 working WebSocket connections to test independence');
    }
    
    // STEP 3: Test message handling independence with precise timing
    console.log('⚡ Step 3: Testing WebSocket message handling independence...');
    
    const BLOCKING_DETECTION_THRESHOLD = 100; // If messages are processed >100ms apart, likely blocking
    
    // Send messages in rapid succession to test for blocking
    const rapidFireTest = async () => {
      console.log('🔥 Rapid-fire message test to detect blocking...');
      
      const globalStartTime = Date.now();
      const sendPromises = workingConnections.map(async (conn, index) => {
        const sendTime = Date.now();
        const offsetFromStart = sendTime - globalStartTime;
        
        const message = {
          type: 'claude-command',
          command: `WebSocket independence test ${index + 1} for ${conn.version}. Respond with "WS${index + 1} (${conn.version}) processing independently" and wait 2 seconds before continuing.`,
          options: {
            projectPath: `/Users/ggomes/.claude/projects/agendamente-${conn.version.toLowerCase()}`,
            projectName: `agendamente-${conn.version.toLowerCase()}`,
            cwd: `/Users/ggomes/IdeaProjects/agendamente-worktrees/${conn.version}`
          }
        };
        
        conn.messagesSent.push({
          message,
          sendTime,
          offsetFromStart
        });
        
        console.log(`📤 WS${index + 1} (${conn.version}): Sending message (offset: ${offsetFromStart}ms)`);
        conn.ws.send(JSON.stringify(message));
        
        return {
          connectionIndex: index + 1,
          version: conn.version,
          sendTime,
          offset: offsetFromStart
        };
      });
      
      return Promise.all(sendPromises);
    };
    
    const sendResults = await rapidFireTest();
    console.log(`⚡ All messages sent within ${Date.now() - sendResults[0].sendTime}ms`);
    
    // STEP 4: Monitor WebSocket message processing patterns
    console.log('👀 Step 4: Monitoring WebSocket message processing patterns...');
    
    const monitoringDuration = 10000; // Monitor for 10 seconds
    const monitoringStartTime = Date.now();
    
    // Track when each WebSocket starts getting responses
    const responseTrackingPromises = workingConnections.map(async (conn, index) => {
      const firstResponseWaitTime = 8000; // Wait up to 8 seconds for first response
      const trackingStartTime = Date.now();
      
      return new Promise((resolve) => {
        const checkForResponse = () => {
          const currentTime = Date.now();
          
          // Check if we've received any Claude responses
          const claudeResponses = conn.responsesReceived.filter(response => 
            response.type === 'claude-response' || response.type === 'claude-output'
          );
          
          if (claudeResponses.length > 0) {
            const firstResponseTime = claudeResponses[0].timestamp;
            const responseDelay = firstResponseTime - conn.messagesSent[0].sendTime;
            
            console.log(`📥 WS${index + 1} (${conn.version}): First response after ${responseDelay}ms`);
            
            resolve({
              connectionIndex: index + 1,
              version: conn.version,
              firstResponseTime,
              responseDelay,
              hasResponse: true
            });
          } else if (currentTime - trackingStartTime > firstResponseWaitTime) {
            console.log(`⚠️ WS${index + 1} (${conn.version}): No response within ${firstResponseWaitTime}ms`);
            
            resolve({
              connectionIndex: index + 1,
              version: conn.version,
              firstResponseTime: null,
              responseDelay: -1,
              hasResponse: false
            });
          } else {
            // Keep checking
            setTimeout(checkForResponse, 200);
          }
        };
        
        checkForResponse();
      });
    });
    
    const responseTracking = await Promise.all(responseTrackingPromises);
    
    // STEP 5: Analyze WebSocket independence
    console.log('\n🔌 WEBSOCKET INDEPENDENCE ANALYSIS:');
    console.log('==================================');
    
    const responsiveConnections = responseTracking.filter(track => track.hasResponse);
    const responseTimes = responsiveConnections.map(track => track.responseDelay);
    
    if (responsiveConnections.length >= 2) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const responseTimeSpread = maxResponseTime - minResponseTime;
      
      console.log(`📊 WebSocket Response Statistics:`);
      console.log(`   ✅ Responsive connections: ${responsiveConnections.length}/${workingConnections.length}`);
      console.log(`   ⏱️ Average response time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   ⏱️ Response time range: ${minResponseTime}ms - ${maxResponseTime}ms`);
      console.log(`   ⏱️ Response time spread: ${responseTimeSpread}ms`);
      
      responsiveConnections.forEach(track => {
        console.log(`   📋 WS${track.connectionIndex} (${track.version}): ${track.responseDelay}ms`);
      });
      
      // Analyze independence
      const INDEPENDENCE_THRESHOLD = 2000; // If response spread < 2s, likely independent
      
      if (responseTimeSpread < INDEPENDENCE_THRESHOLD) {
        console.log(`\n🎉 WEBSOCKET INDEPENDENCE CONFIRMED!`);
        console.log(`   ✅ Response spread (${responseTimeSpread}ms) < threshold (${INDEPENDENCE_THRESHOLD}ms)`);
        console.log(`   ✅ WebSocket messages are processed independently`);
        console.log(`   ✅ No blocking detected between WebSocket connections`);
        console.log(`   ✅ server/index.js WebSocket handler is working correctly`);
      } else {
        console.log(`\n❌ WEBSOCKET BLOCKING DETECTED!`);
        console.log(`   ❌ Response spread (${responseTimeSpread}ms) > threshold (${INDEPENDENCE_THRESHOLD}ms)`);
        console.log(`   ❌ WebSocket messages appear to be blocking each other`);
        console.log(`   ❌ server/index.js WebSocket handler needs investigation`);
      }
    } else {
      console.log(`\n❌ INSUFFICIENT WEBSOCKET RESPONSES: Only ${responsiveConnections.length} connections responded`);
    }
    
    // STEP 6: Test message queue behavior
    console.log('\n📨 Step 6: Testing WebSocket message queue behavior...');
    
    // Send a burst of messages to see if they queue or process in parallel
    const burstTestStartTime = Date.now();
    const burstMessages = [];
    
    for (let i = 0; i < workingConnections.length; i++) {
      const conn = workingConnections[i];
      const burstMessage = {
        type: 'claude-command',
        command: `Burst test message ${i + 1} for ${conn.version}. Just respond "Burst ${i + 1} processed" quickly.`,
        options: {
          projectPath: `/Users/ggomes/.claude/projects/agendamente-${conn.version.toLowerCase()}`,
          projectName: `agendamente-${conn.version.toLowerCase()}`,
          cwd: `/Users/ggomes/IdeaProjects/agendamente-worktrees/${conn.version}`
        }
      };
      
      const sendTime = Date.now();
      conn.ws.send(JSON.stringify(burstMessage));
      
      burstMessages.push({
        connectionIndex: i + 1,
        version: conn.version,
        sendTime: sendTime,
        offsetFromBurst: sendTime - burstTestStartTime
      });
      
      console.log(`💥 Burst message ${i + 1} (${conn.version}) sent at offset ${sendTime - burstTestStartTime}ms`);
    }
    
    console.log(`💥 Burst test: ${burstMessages.length} messages sent within ${Date.now() - burstTestStartTime}ms`);
    
    // STEP 7: Take diagnostic screenshot
    await page.goto('http://localhost:3001');
    await page.screenshot({ path: 'test-results/websocket-independence-analysis.png', fullPage: true });
    
    // STEP 8: Close WebSocket connections
    console.log('\n🔌 Step 8: Closing WebSocket connections...');
    
    for (let i = 0; i < websockets.length; i++) {
      if (websockets[i].readyState === WebSocket.OPEN) {
        websockets[i].close();
        console.log(`🔌 Closed WebSocket ${i + 1}`);
      }
    }
    
    // Clean up test worktrees
    for (const version of testVersions) {
      await fetch(`http://localhost:3000/api/worktree/${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    // STEP 9: Final WebSocket independence assessment
    console.log('\n🔌 FINAL WEBSOCKET INDEPENDENCE ASSESSMENT:');
    console.log('==========================================');
    
    const webSocketIndependence = responsiveConnections.length >= 2 && 
      Math.max(...responseTimes) - Math.min(...responseTimes) < 2000;
    
    if (webSocketIndependence) {
      console.log('✅ SUCCESS: WebSocket message handling is independent!');
      console.log('   ✅ Multiple WebSocket connections process messages in parallel');
      console.log('   ✅ No blocking in server/index.js WebSocket message handler');
      console.log('   ✅ spawnClaude() is called without blocking await');
      console.log('   ✅ WebSocket infrastructure supports concurrent sessions');
    } else {
      console.log('❌ FAILURE: WebSocket message handling is blocking!');
      console.log('   ❌ WebSocket connections are not processing independently');
      console.log('   ❌ server/index.js WebSocket handler may still have blocking code');
      console.log('   ❌ spawnClaude() may still be using blocking await');
      console.log('   ❌ WebSocket infrastructure needs fixing');
    }
    
    console.log('\n✅ WEBSOCKET INDEPENDENCE TEST COMPLETE');
    
    // Fail the test if WebSocket independence is not working
    expect(webSocketIndependence).toBe(true);
    expect(responsiveConnections.length).toBeGreaterThanOrEqual(2);
  });
});