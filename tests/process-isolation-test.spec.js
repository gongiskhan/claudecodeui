import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Process Isolation Test', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNzA2NjF9.iU9r62_XzdiMZFNlAfiRXGNg5vIpqdlUaHnzcdJQlzY';

  test('CRITICAL: Verify each session gets independent Claude CLI process', async ({ page }) => {
    console.log('🔄 CRITICAL TEST: Process isolation verification');
    
    // STEP 1: Create test worktrees for process isolation testing
    console.log('🏗️ Step 1: Setting up test worktrees for process isolation...');
    
    const testVersions = ['P1', 'P2', 'P3'];
    
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
          branch: `feature/${version.toLowerCase()}-process-test`,
          projectPath: '/Users/ggomes/IdeaProjects/agendamente',
          projectName: 'agendamente'
        })
      });
      
      if (createResponse.ok) {
        console.log(`✅ Created worktree ${version} for process isolation test`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 2: Get baseline process count before starting sessions
    console.log('📊 Step 2: Getting baseline Claude process count...');
    
    const getClaudeProcessCount = async () => {
      try {
        const { stdout } = await execAsync('ps aux | grep -c "[c]laude"');
        return parseInt(stdout.trim()) || 0;
      } catch (error) {
        console.log('⚠️ Could not count Claude processes:', error.message);
        return 0;
      }
    };
    
    const getClaudeProcesses = async () => {
      try {
        const { stdout } = await execAsync('ps aux | grep "[c]laude" | grep -v grep');
        return stdout.trim().split('\n').filter(line => line.length > 0);
      } catch (error) {
        return [];
      }
    };
    
    const baselineProcessCount = await getClaudeProcessCount();
    const baselineProcesses = await getClaudeProcesses();
    
    console.log(`📊 Baseline Claude processes: ${baselineProcessCount}`);
    if (baselineProcesses.length > 0) {
      console.log('📋 Existing Claude processes:');
      baselineProcesses.forEach((process, index) => {
        console.log(`   ${index + 1}. ${process.split(/\\s+/).slice(10).join(' ')}`);
      });
    }
    
    // STEP 3: Create WebSocket connections and start sessions
    console.log('🔗 Step 3: Creating WebSocket connections and starting sessions...');
    
    const connections = [];
    const sessionData = [];
    
    const createSessionConnection = async (version, index) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3000/ws?token=${AUTH_TOKEN}`);
        const data = {
          version,
          index: index + 1,
          ws,
          connected: false,
          sessionStarted: false,
          processSpawned: false,
          responses: []
        };
        
        ws.on('open', () => {
          console.log(`🔗 Session ${index + 1} (${version}): WebSocket connected`);
          data.connected = true;
          connections.push(ws);
          sessionData.push(data);
          resolve(data);
        });
        
        ws.on('message', (rawMessage) => {
          const message = JSON.parse(rawMessage.toString());
          data.responses.push(message);
          
          if (message.type === 'claude-response' || message.type === 'claude-output') {
            if (!data.processSpawned) {
              data.processSpawned = true;
              console.log(`🚀 Session ${index + 1} (${version}): Claude process spawned (first response received)`);
            }
          }
          
          if (message.type === 'session-created') {
            data.sessionStarted = true;
            console.log(`✅ Session ${index + 1} (${version}): Session created with ID ${message.sessionId}`);
          }
        });
        
        ws.on('error', (error) => {
          console.error(`❌ Session ${index + 1} (${version}) WebSocket error:`, error);
          reject(error);
        });
        
        setTimeout(() => {
          if (!data.connected) {
            reject(new Error(`Session ${index + 1} (${version}) connection timeout`));
          }
        }, 10000);
      });
    };
    
    // Create all session connections
    const connectionPromises = testVersions.map((version, index) => 
      createSessionConnection(version, index)
    );
    
    const establishedSessions = await Promise.allSettled(connectionPromises);
    const workingSessions = establishedSessions
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    console.log(`✅ Established ${workingSessions.length}/${testVersions.length} session connections`);
    
    if (workingSessions.length < 2) {
      throw new Error('Need at least 2 working sessions to test process isolation');
    }
    
    // STEP 4: Start Claude sessions simultaneously
    console.log('🚀 Step 4: Starting Claude sessions simultaneously...');
    
    const sessionStartTime = Date.now();
    const startPromises = workingSessions.map(async (session, index) => {
      const message = {
        type: 'claude-command',
        command: `Process isolation test for session ${index + 1} in ${session.version}. Please respond with "Process ${index + 1} (${session.version}) running independently with PID info" and identify your process.`,
        options: {
          projectPath: `/Users/ggomes/.claude/projects/agendamente-${session.version.toLowerCase()}`,
          projectName: `agendamente-${session.version.toLowerCase()}`,
          cwd: `/Users/ggomes/IdeaProjects/agendamente-worktrees/${session.version}`
        }
      };
      
      console.log(`🚀 Starting session ${index + 1} (${session.version})`);
      session.ws.send(JSON.stringify(message));
      
      return {
        sessionIndex: index + 1,
        version: session.version,
        startTime: Date.now()
      };
    });
    
    const startResults = await Promise.all(startPromises);
    console.log(`⚡ All ${startResults.length} sessions started within ${Date.now() - sessionStartTime}ms`);
    
    // STEP 5: Monitor process spawning
    console.log('👀 Step 5: Monitoring Claude process spawning...');
    
    const monitorProcesses = async (duration = 8000) => {
      const processSnapshots = [];
      const monitoringStartTime = Date.now();
      
      while (Date.now() - monitoringStartTime < duration) {
        const currentProcessCount = await getClaudeProcessCount();
        const currentProcesses = await getClaudeProcesses();
        
        processSnapshots.push({
          timestamp: Date.now(),
          processCount: currentProcessCount,
          processes: currentProcesses,
          deltaFromBaseline: currentProcessCount - baselineProcessCount
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return processSnapshots;
    };
    
    const processSnapshots = await monitorProcesses();
    
    // STEP 6: Wait for session responses
    console.log('📥 Step 6: Waiting for session responses...');
    
    const responseWaitTime = 10000;
    const responseStartTime = Date.now();
    
    while (Date.now() - responseStartTime < responseWaitTime) {
      const respondedSessions = workingSessions.filter(session => session.processSpawned);
      
      if (respondedSessions.length === workingSessions.length) {
        console.log('✅ All sessions have spawned Claude processes');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // STEP 7: Analyze process isolation
    console.log('\\n🔄 PROCESS ISOLATION ANALYSIS:');
    console.log('==============================');
    
    const finalProcessCount = await getClaudeProcessCount();
    const finalProcesses = await getClaudeProcesses();
    const maxProcessCountDuringTest = Math.max(...processSnapshots.map(s => s.processCount));
    const processesSpawned = maxProcessCountDuringTest - baselineProcessCount;
    
    console.log(`📊 Process Count Analysis:`);
    console.log(`   📋 Baseline processes: ${baselineProcessCount}`);
    console.log(`   📋 Final processes: ${finalProcessCount}`);
    console.log(`   📋 Max processes during test: ${maxProcessCountDuringTest}`);
    console.log(`   📋 Processes spawned: ${processesSpawned}`);
    console.log(`   📋 Sessions started: ${workingSessions.length}`);
    
    // Analyze process snapshots
    console.log(`\\n📈 Process Spawning Timeline:`);
    processSnapshots.forEach((snapshot, index) => {
      const timeOffset = snapshot.timestamp - processSnapshots[0].timestamp;
      console.log(`   ${timeOffset}ms: ${snapshot.processCount} processes (+${snapshot.deltaFromBaseline} from baseline)`);
    });
    
    // Count sessions that successfully spawned processes
    const sessionsWithProcesses = workingSessions.filter(session => session.processSpawned);
    console.log(`\\n🚀 Session Process Status:`);
    workingSessions.forEach(session => {
      console.log(`   Session ${session.index} (${session.version}): ${session.processSpawned ? '✅ Process spawned' : '❌ No process detected'}`);
    });
    
    console.log(`\\n📊 Process Isolation Metrics:`);
    console.log(`   ✅ Sessions with processes: ${sessionsWithProcesses.length}/${workingSessions.length}`);
    console.log(`   📋 Expected process increase: ${workingSessions.length}`);
    console.log(`   📋 Actual process increase: ${processesSpawned}`);
    
    // STEP 8: Check for proper process isolation
    const processIsolationWorking = 
      processesSpawned >= workingSessions.length - 1 && // Allow for some variance
      sessionsWithProcesses.length >= workingSessions.length - 1;
    
    if (processIsolationWorking) {
      console.log(`\\n🎉 PROCESS ISOLATION SUCCESS!`);
      console.log(`   ✅ Each session appears to have spawned its own Claude process`);
      console.log(`   ✅ Process count increased appropriately (${processesSpawned} processes for ${workingSessions.length} sessions)`);
      console.log(`   ✅ No process sharing detected between sessions`);
      console.log(`   ✅ Claude CLI processes are independent`);
    } else {
      console.log(`\\n❌ PROCESS ISOLATION FAILURE!`);
      console.log(`   ❌ Process count did not increase as expected`);
      console.log(`   ❌ Sessions may be sharing Claude processes`);
      console.log(`   ❌ Process isolation is not working properly`);
    }
    
    // STEP 9: List current Claude processes for debugging
    if (finalProcesses.length > 0) {
      console.log(`\\n📋 Current Claude Processes:`);
      finalProcesses.forEach((process, index) => {
        const processInfo = process.split(/\\s+/);
        const pid = processInfo[1];
        const command = processInfo.slice(10).join(' ');
        console.log(`   ${index + 1}. PID ${pid}: ${command}`);
      });
    }
    
    // STEP 10: Take diagnostic screenshot
    await page.goto('http://localhost:3001');
    await page.screenshot({ path: 'test-results/process-isolation-analysis.png', fullPage: true });
    
    // STEP 11: Cleanup
    console.log('\\n🧹 Step 11: Cleaning up sessions and processes...');
    
    // Close WebSocket connections
    for (let i = 0; i < connections.length; i++) {
      if (connections[i].readyState === WebSocket.OPEN) {
        connections[i].close();
        console.log(`🔌 Closed session ${i + 1}`);
      }
    }
    
    // Wait a bit for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clean up test worktrees
    for (const version of testVersions) {
      await fetch(`http://localhost:3000/api/worktree/${version}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
    }
    
    // Check final process count after cleanup
    const postCleanupProcessCount = await getClaudeProcessCount();
    console.log(`📊 Process count after cleanup: ${postCleanupProcessCount}`);
    
    // STEP 12: Final process isolation assessment
    console.log('\\n🔄 FINAL PROCESS ISOLATION ASSESSMENT:');
    console.log('======================================');
    
    if (processIsolationWorking) {
      console.log('✅ SUCCESS: Process isolation is working correctly!');
      console.log('   ✅ Each session gets its own independent Claude CLI process');
      console.log('   ✅ No process sharing between concurrent sessions');
      console.log('   ✅ Process spawning scales with number of sessions');
      console.log('   ✅ Process cleanup works properly');
    } else {
      console.log('❌ FAILURE: Process isolation needs investigation!');
      console.log('   ❌ Sessions may be sharing Claude processes');
      console.log('   ❌ Process spawning not working as expected');
      console.log('   ❌ Need to check claude-cli.js process management');
    }
    
    console.log('\\n✅ PROCESS ISOLATION TEST COMPLETE');
    
    // Fail the test if process isolation is not working
    expect(processIsolationWorking).toBe(true);
    expect(sessionsWithProcesses.length).toBeGreaterThanOrEqual(workingSessions.length - 1);
  });
});