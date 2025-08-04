import { test, expect } from '@playwright/test';

test.describe('Admin-App Bug Detection and Fix', () => {
  let authToken = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'testuser', password: 'testpass123' }
    });
    
    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      console.log('✅ Auth token obtained');
    }
    
    await context.close();
  });

  test('1. Clean State - Remove Any Existing Admin-App Projects', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Cleaning up any existing admin-app projects...');
    
    // Get current projects
    const response = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(response.ok()).toBeTruthy();
    const projects = await response.json();
    
    console.log('📋 Current projects:');
    projects.forEach(p => {
      console.log(`  - ${p.displayName} (name: ${p.name}) [worktree: ${p.isWorktree || false}]`);
    });
    
    // Find and report admin-app projects
    const adminAppProjects = projects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`🚨 Found ${adminAppProjects.length} admin-app projects`);
    
    if (adminAppProjects.length > 0) {
      console.log('🔍 Admin-app project details:');
      adminAppProjects.forEach(p => {
        console.log(`  - DisplayName: ${p.displayName}, Name: ${p.name}, Path: ${p.path}`);
      });
    }
  });

  test('2. Test Message Send to Worktree - Check for Admin-App Creation', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧪 Testing message send to worktree without creating admin-app...');
    
    // First ensure we have a V2 worktree
    let createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/test-v2',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (createResponse.ok()) {
      console.log('✅ V2 worktree created for testing');
    } else {
      console.log('ℹ️ V2 worktree already exists or creation failed');
    }
    
    // Get projects before message
    let beforeResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const beforeProjects = await beforeResponse.json();
    const beforeAdminApp = beforeProjects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`📊 Before message - Admin-app projects: ${beforeAdminApp.length}`);
    
    // Navigate to UI and set auth
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Look for V2 worktree in UI and click it
    const worktreeElement = page.locator('text=agendamente - V2').first();
    if (await worktreeElement.isVisible()) {
      await worktreeElement.click();
      console.log('🖱️ Clicked on V2 worktree');
      await page.waitForTimeout(2000);
      
      // Try to send a test message (simulate the bug)
      const messageInput = page.locator('textarea, input[type="text"]').first();
      if (await messageInput.isVisible()) {
        await messageInput.fill('test message');
        await messageInput.press('Enter');
        console.log('📝 Sent test message to worktree');
        await page.waitForTimeout(3000);
      }
    }
    
    // Check projects after message
    let afterResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const afterProjects = await afterResponse.json();
    const afterAdminApp = afterProjects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`📊 After message - Admin-app projects: ${afterAdminApp.length}`);
    
    if (afterAdminApp.length > beforeAdminApp.length) {
      console.log('🚨 BUG DETECTED: Admin-app project was created after message!');
      console.log('🔍 New admin-app project details:');
      afterAdminApp.forEach(p => {
        console.log(`  - DisplayName: ${p.displayName}, Name: ${p.name}, Path: ${p.path}`);
      });
      
      // This test should fail to highlight the bug
      expect(afterAdminApp.length).toBe(beforeAdminApp.length);
    } else {
      console.log('✅ No admin-app project created - bug is fixed!');
    }
    
    await page.screenshot({ path: 'test-results/admin-app-bug-test.png', fullPage: true });
  });

  test('3. Debug Claude CLI Session Creation', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🔍 Debugging Claude CLI session creation process...');
    
    // Check the Claude sessions directory to see what's being created
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      // Check Claude sessions directory
      const claudeSessionsPath = '/Users/ggomes/.claude/sessions';
      const sessions = await fs.readdir(claudeSessionsPath);
      
      console.log('📁 Claude sessions found:');
      sessions.forEach(session => {
        console.log(`  - ${session}`);
      });
      
      // Look for admin-app related sessions
      const adminAppSessions = sessions.filter(s => s.includes('admin-app'));
      if (adminAppSessions.length > 0) {
        console.log('🚨 Found admin-app sessions:');
        adminAppSessions.forEach(s => {
          console.log(`  - ${s}`);
        });
      }
      
      // Look for agendamente related sessions  
      const agendamenteSessions = sessions.filter(s => s.includes('agendamente'));
      console.log('📋 Agendamente sessions:');
      agendamenteSessions.forEach(s => {
        console.log(`  - ${s}`);
      });
      
    } catch (error) {
      console.log('⚠️ Could not read Claude sessions directory:', error.message);
    }
  });

  test('4. Check Package.json Files for Admin-App References', async ({ page }) => {
    console.log('🔍 Checking package.json files for admin-app references...');
    
    const fs = require('fs').promises;
    const path = require('path');
    
    const projectPaths = [
      '/Users/ggomes/IdeaProjects/agendamente',
      '/Users/ggomes/IdeaProjects/agendamente/worktrees/agendamente-v2'
    ];
    
    for (const projectPath of projectPaths) {
      try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = await fs.readFile(packageJsonPath, 'utf8');
        const packageData = JSON.parse(packageJson);
        
        console.log(`📦 ${projectPath}/package.json:`);
        console.log(`  - name: ${packageData.name}`);
        console.log(`  - displayName: ${packageData.displayName || 'not set'}`);
        
        if (packageData.name === 'admin-app') {
          console.log('🚨 Found admin-app name in package.json!');
        }
        
      } catch (error) {
        console.log(`⚠️ Could not read ${projectPath}/package.json:`, error.message);
      }
    }
  });

  test('5. Cleanup - Remove Admin-App Projects', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Final cleanup of admin-app projects...');
    
    // Get all projects
    const response = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const projects = await response.json();
    const adminAppProjects = projects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`🗑️ Found ${adminAppProjects.length} admin-app projects to clean up`);
    
    // Note: We can't easily delete these through API since they're not real worktrees
    // This test documents the issue for manual cleanup
    
    // Clean up test worktree
    const deleteResponse = await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (deleteResponse.ok()) {
      console.log('✅ Cleaned up test V2 worktree');
    }
  });
});