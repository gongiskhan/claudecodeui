import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

test.describe('Stress Test Concurrent Sessions', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNzA2NjF9.iU9r62_XzdiMZFNlAfiRXGNg5vIpqdlUaHnzcdJQlzY';

  test('STRESS: High load concurrent sessions test', async ({ page }) => {
    console.log('💪 STRESS TEST: High load concurrent sessions');
    
    // STEP 1: Configure stress test parameters
    const STRESS_SESSION_COUNT = 8; // Test with 8 concurrent sessions
    const CONNECTION_TIMEOUT = 15000;
    const RESPONSE_TIMEOUT = 20000;
    
    console.log(`🏗️ Step 1: Setting up stress test with ${STRESS_SESSION_COUNT} concurrent sessions...`);
    
    // Create worktrees for stress testing
    const stressVersions = [];
    for (let i = 1; i <= STRESS_SESSION_COUNT; i++) {
      stressVersions.push(`S${i}`);
    }
    
    const worktreeCreationPromises = stressVersions.map(async (version, index) => {
      try {
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
            branch: `feature/${version.toLowerCase()}-stress-test`,
            projectPath: '/Users/ggomes/IdeaProjects/agendamente',
            projectName: 'agendamente'
          })
        });
        
        if (createResponse.ok) {
          console.log(`✅ Created stress test worktree ${version}`);
          return { version, success: true };
        } else {
          console.log(`❌ Failed to create stress test worktree ${version}`);
          return { version, success: false };
        }
      } catch (error) {
        console.log(`❌ Error creating worktree ${version}:`, error.message);
        return { version, success: false, error: error.message };
      }
    });
    
    const worktreeResults = await Promise.all(worktreeCreationPromises);
    const successfulWorktrees = worktreeResults.filter(result => result.success);
    
    console.log(`✅ Created ${successfulWorktrees.length}/${STRESS_SESSION_COUNT} stress test worktrees`);
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // STEP 2: Create high volume of WebSocket connections
    console.log('🔗 Step 2: Creating high volume of WebSocket connections...');
    
    const connections = [];
    const connectionData = [];
    const connectionFailures = [];
    
    const createStressConnection = (version, index) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws?token=${AUTH_TOKEN}`);
        const data = {
          version,
          index: index + 1,
          ws,
          connected: false,
          messagesSent: 0,
          responsesReceived: 0,
          firstResponseTime: null,
          lastResponseTime: null,
          errors: [],
          startTime: null
        };
        
        const connectionTimer = setTimeout(() => {
          if (!data.connected) {
            reject(new Error(`Connection ${index + 1} (${version}) timeout after ${CONNECTION_TIMEOUT}ms`));
          }
        }, CONNECTION_TIMEOUT);
        
        ws.on('open', () => {
          clearTimeout(connectionTimer);
          console.log(`🔗 Stress connection ${index + 1} (${version}) established`);
          data.connected = true;
          connections.push(ws);
          connectionData.push(data);
          resolve(data);
        });
        
        ws.on('message', (rawMessage) => {
          const receiveTime = Date.now();
          try {
            const message = JSON.parse(rawMessage.toString());
            data.responsesReceived++;
            data.lastResponseTime = receiveTime;
            
            if (!data.firstResponseTime && 
                (message.type === 'claude-response' || message.type === 'claude-output')) {
              data.firstResponseTime = receiveTime;
              const responseDelay = receiveTime - data.startTime;
              console.log(`📥 Stress ${index + 1} (${version}): First response after ${responseDelay}ms`);
            }
          } catch (parseError) {
            data.errors.push(`Parse error: ${parseError.message}`);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(connectionTimer);
          data.errors.push(`WebSocket error: ${error.message}`);
          console.error(`❌ Stress connection ${index + 1} (${version}) error:`, error.message);
          reject(error);
        });
        
        ws.on('close', () => {
          console.log(`🔌 Stress connection ${index + 1} (${version}) closed`);
        });
      });
    };
    
    // Create all connections in parallel
    const connectionPromises = stressVersions.map((version, index) => 
      createStressConnection(version, index).catch(error => {
        connectionFailures.push({ version, index: index + 1, error: error.message });
        return null;
      })
    );
    
    const connectionResults = await Promise.allSettled(connectionPromises);
    const workingConnections = connectionResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
    
    console.log(`✅ Established ${workingConnections.length}/${STRESS_SESSION_COUNT} stress connections`);
    
    if (connectionFailures.length > 0) {
      console.log(`❌ Connection failures:`);
      connectionFailures.forEach(failure => {
        console.log(`   ${failure.version}: ${failure.error}`);
      });
    }
    
    if (workingConnections.length < 3) {
      throw new Error(`Insufficient connections for stress test: ${workingConnections.length}/${STRESS_SESSION_COUNT}`);
    }
    
    // STEP 3: Send high volume of messages simultaneously
    console.log('⚡ Step 3: Sending high volume of messages simultaneously...');
    
    const stressTestStartTime = Date.now();
    const messagePromises = workingConnections.map(async (conn, index) => {
      try {
        const message = {
          type: 'claude-command',
          command: `Stress test session ${index + 1} for ${conn.version}. This is a high-load concurrent test. Please respond with "Stress session ${index + 1} (${conn.version}) processing under load" and perform a simple calculation like 2+2 to confirm processing.`,
          options: {
            projectPath: `/Users/ggomes/.claude/projects/agendamente-${conn.version.toLowerCase()}`,
            projectName: `agendamente-${conn.version.toLowerCase()}`,
            cwd: `/Users/ggomes/IdeaProjects/agendamente-worktrees/${conn.version}`
          }
        };
        
        conn.startTime = Date.now();
        const offset = conn.startTime - stressTestStartTime;
        
        conn.ws.send(JSON.stringify(message));
        conn.messagesSent++;
        
        console.log(`📤 Stress message ${index + 1} (${conn.version}) sent (offset: ${offset}ms)`);
        
        return {
          connectionIndex: index + 1,
          version: conn.version,
          sendTime: conn.startTime,
          offset: offset,
          success: true
        };
      } catch (error) {
        console.log(`❌ Failed to send stress message ${index + 1} (${conn.version}):`, error.message);
        return {
          connectionIndex: index + 1,
          version: conn.version,
          success: false,
          error: error.message
        };
      }
    });
    
    const sendResults = await Promise.all(messagePromises);
    const successfulSends = sendResults.filter(result => result.success);
    
    console.log(`⚡ Stress test: ${successfulSends.length} messages sent within ${Date.now() - stressTestStartTime}ms`);
    
    // STEP 4: Monitor system behavior under load
    console.log('📊 Step 4: Monitoring system behavior under high load...');
    
    const monitoringDuration = RESPONSE_TIMEOUT;
    const monitoringStartTime = Date.now();
    const performanceSnapshots = [];
    
    // Take performance snapshots during the test
    const performanceMonitoring = setInterval(() => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - monitoringStartTime;
      
      const responsiveConnections = workingConnections.filter(conn => conn.firstResponseTime !== null);
      const totalResponses = workingConnections.reduce((sum, conn) => sum + conn.responsesReceived, 0);
      const totalErrors = workingConnections.reduce((sum, conn) => sum + conn.errors.length, 0);
      
      const snapshot = {
        timestamp: currentTime,
        elapsedTime,
        responsiveConnections: responsiveConnections.length,
        totalConnections: workingConnections.length,
        totalResponses,
        totalErrors,
        responsivePercentage: (responsiveConnections.length / workingConnections.length) * 100
      };
      
      performanceSnapshots.push(snapshot);
      console.log(`📊 Load snapshot at ${Math.round(elapsedTime/1000)}s: ${responsiveConnections.length}/${workingConnections.length} responsive (${Math.round(snapshot.responsivePercentage)}%)`);
      
    }, 2000);
    
    // Wait for responses
    const responseWaitStart = Date.now();
    while (Date.now() - responseWaitStart < RESPONSE_TIMEOUT) {
      const responsiveConnections = workingConnections.filter(conn => conn.firstResponseTime !== null);
      
      if (responsiveConnections.length === workingConnections.length) {
        console.log('✅ All stress connections have responded');
        break;
      }
      
      if (responsiveConnections.length >= Math.ceil(workingConnections.length * 0.8)) {
        console.log(`✅ 80%+ stress connections have responded (${responsiveConnections.length}/${workingConnections.length})`);
        // Continue monitoring but consider this acceptable
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    clearInterval(performanceMonitoring);
    
    // STEP 5: Analyze stress test results
    console.log('\\n💪 STRESS TEST ANALYSIS:');
    console.log('========================');
    
    const finalResponsiveConnections = workingConnections.filter(conn => conn.firstResponseTime !== null);
    const responseTimes = finalResponsiveConnections.map(conn => conn.firstResponseTime - conn.startTime);
    const totalErrors = workingConnections.reduce((sum, conn) => sum + conn.errors.length, 0);
    
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const responseSpread = maxResponseTime - minResponseTime;
      
      console.log(`📊 Stress Test Performance Metrics:`);
      console.log(`   🎯 Target sessions: ${STRESS_SESSION_COUNT}`);
      console.log(`   ✅ Working connections: ${workingConnections.length}`);
      console.log(`   📥 Responsive sessions: ${finalResponsiveConnections.length}`);
      console.log(`   📊 Success rate: ${Math.round((finalResponsiveConnections.length / workingConnections.length) * 100)}%`);
      console.log(`   ⏱️ Average response time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   ⏱️ Response time range: ${minResponseTime}ms - ${maxResponseTime}ms`);
      console.log(`   ⏱️ Response spread: ${responseSpread}ms`);
      console.log(`   ❌ Total errors: ${totalErrors}`);
      
      // Individual session performance
      console.log(`\\n📋 Individual Session Performance:`);
      workingConnections.forEach(conn => {
        const responseTime = conn.firstResponseTime ? conn.firstResponseTime - conn.startTime : -1;
        const status = responseTime > 0 ? `${responseTime}ms` : 'No response';
        const errorCount = conn.errors.length;
        console.log(`   ${conn.version}: ${status}${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
      });
    }
    
    // Performance timeline
    if (performanceSnapshots.length > 0) {
      console.log(`\\n📈 Performance Timeline:`);
      performanceSnapshots.forEach(snapshot => {
        console.log(`   ${Math.round(snapshot.elapsedTime/1000)}s: ${snapshot.responsiveConnections}/${snapshot.totalConnections} sessions (${Math.round(snapshot.responsivePercentage)}%) - ${snapshot.totalResponses} responses, ${snapshot.totalErrors} errors`);
      });
    }
    
    // STEP 6: Determine stress test success
    const STRESS_SUCCESS_THRESHOLD = 0.7; // 70% of sessions should respond
    const ACCEPTABLE_RESPONSE_SPREAD = 5000; // 5 seconds spread acceptable under stress
    
    const successRate = finalResponsiveConnections.length / workingConnections.length;
    const responseSpread = responseTimes.length > 1 ? Math.max(...responseTimes) - Math.min(...responseTimes) : 0;
    
    const stressTestPassed = 
      successRate >= STRESS_SUCCESS_THRESHOLD &&
      responseSpread <= ACCEPTABLE_RESPONSE_SPREAD &&
      totalErrors < workingConnections.length; // Less than one error per connection
    
    if (stressTestPassed) {
      console.log(`\\n🎉 STRESS TEST PASSED!`);
      console.log(`   ✅ Success rate (${Math.round(successRate * 100)}%) >= threshold (${Math.round(STRESS_SUCCESS_THRESHOLD * 100)}%)`);
      console.log(`   ✅ Response spread (${responseSpread}ms) <= threshold (${ACCEPTABLE_RESPONSE_SPREAD}ms)`);
      console.log(`   ✅ Error rate acceptable (${totalErrors} errors for ${workingConnections.length} connections)`);
      console.log(`   ✅ System handles high concurrent load gracefully`);
      console.log(`   ✅ No blocking detected under stress conditions`);
    } else {
      console.log(`\\n❌ STRESS TEST FAILED!`);
      if (successRate < STRESS_SUCCESS_THRESHOLD) {
        console.log(`   ❌ Success rate (${Math.round(successRate * 100)}%) < threshold (${Math.round(STRESS_SUCCESS_THRESHOLD * 100)}%)`);
      }
      if (responseSpread > ACCEPTABLE_RESPONSE_SPREAD) {
        console.log(`   ❌ Response spread (${responseSpread}ms) > threshold (${ACCEPTABLE_RESPONSE_SPREAD}ms)`);
      }
      if (totalErrors >= workingConnections.length) {
        console.log(`   ❌ Too many errors (${totalErrors} errors for ${workingConnections.length} connections)`);
      }
      console.log(`   ❌ System may not handle high concurrent load properly`);
    }
    
    // STEP 7: Take diagnostic screenshot
    await page.goto('http://localhost:3001');
    await page.screenshot({ path: 'test-results/stress-test-analysis.png', fullPage: true });
    
    // STEP 8: Cleanup stress test
    console.log('\\n🧹 Step 8: Cleaning up stress test...');
    
    // Close all WebSocket connections
    for (let i = 0; i < connections.length; i++) {
      if (connections[i].readyState === WebSocket.OPEN) {
        connections[i].close();
      }
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clean up test worktrees
    const cleanupPromises = stressVersions.map(async (version) => {
      try {
        await fetch(`http://localhost:3000/api/worktree/${version}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        console.log(`🧹 Cleaned up stress worktree ${version}`);
      } catch (error) {
        console.log(`⚠️ Failed to cleanup worktree ${version}:`, error.message);
      }
    });
    
    await Promise.all(cleanupPromises);
    
    // STEP 9: Final stress test assessment
    console.log('\\n💪 FINAL STRESS TEST ASSESSMENT:');
    console.log('=================================');
    
    if (stressTestPassed) {
      console.log('✅ SUCCESS: System handles high concurrent load!');
      console.log('   ✅ Multiple concurrent sessions work under stress');
      console.log('   ✅ No blocking behavior detected under load');
      console.log('   ✅ System scales reasonably with concurrent sessions');
      console.log('   ✅ Error handling is robust under stress');
      console.log('   ✅ Performance degrades gracefully if at all');
    } else {
      console.log('❌ FAILURE: System struggles with high concurrent load!');
      console.log('   ❌ Too many sessions fail under stress conditions');
      console.log('   ❌ Possible blocking or resource contention issues');
      console.log('   ❌ System may not scale well with concurrent sessions');
      console.log('   ❌ Need to investigate resource management');
    }
    
    console.log('\\n✅ STRESS TEST COMPLETE');
    
    // Fail the test if stress conditions are not handled
    expect(stressTestPassed).toBe(true);
    expect(successRate).toBeGreaterThanOrEqual(STRESS_SUCCESS_THRESHOLD);
  });
});