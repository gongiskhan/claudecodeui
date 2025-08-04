import { test, expect } from '@playwright/test';

test.describe('Worktree Fix and Test', () => {
  let authToken = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Get auth token
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

  test('1. Fix Authentication - Set Token in Browser', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3001');
    
    // Set auth token in localStorage
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    
    // Refresh to pick up auth token
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Take screenshot to see if projects load
    await page.screenshot({ path: 'test-results/after-auth-fix.png', fullPage: true });
    
    // Check if we can see projects now
    const pageText = await page.textContent('body');
    const hasProjects = pageText.includes('agendamente') || pageText.includes('projects');
    
    console.log('🔍 Auth fix result - has projects:', hasProjects);
    console.log('📄 Page text sample:', pageText.substring(0, 200));
    
    if (hasProjects) {
      console.log('✅ Authentication fix successful');
    } else {
      console.log('❌ Authentication fix failed');
    }
  });

  test('2. Fix Git Branch Issue - Switch to Different Branch', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token');
      return;
    }
    
    // First, let's try switching the main project to a different branch
    // so we can create worktrees from 'main'
    
    console.log('🔧 Attempting to fix git branch conflict...');
    
    // Try creating worktree with a new branch instead
    const response = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2', // Use a new branch name instead of main
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (response.ok()) {
      console.log('✅ V2 worktree created with new branch');
      const result = await response.json();
      console.log('📋 Creation result:', result);
    } else {
      const error = await response.text();
      console.log('❌ V2 worktree creation failed:', response.status(), error);
    }
  });

  test('3. Verify Worktree Creation', async ({ page }) => {
    // Set auth and navigate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/after-worktree-creation.png', fullPage: true });
    
    // Check projects via API
    const projectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (projectsResponse.ok()) {
      const projects = await projectsResponse.json();
      console.log('📋 Projects after worktree creation:');
      projects.forEach(p => {
        console.log(`  - ${p.displayName} (${p.name}) [worktree: ${p.isWorktree || false}]`);
      });
      
      const worktreeProjects = projects.filter(p => p.isWorktree);
      console.log(`🌳 Total worktree projects: ${worktreeProjects.length}`);
      
      if (worktreeProjects.length > 0) {
        console.log('✅ Worktree creation successful');
      }
    }
  });

  test('4. Test Worktree Session Isolation', async ({ page }) => {
    // Set auth and navigate
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(3000);
    
    // Look for worktree project in UI
    const pageText = await page.textContent('body');
    if (pageText.includes('V2') || pageText.includes('agendamente')) {
      console.log('✅ Worktree visible in UI');
      
      // Try to click on worktree project if visible
      const worktreeProject = page.locator('text=agendamente').first();
      if (await worktreeProject.isVisible()) {
        await worktreeProject.click();
        await page.waitForTimeout(2000);
        console.log('🖱️ Clicked on worktree project');
      }
    } else {
      console.log('❌ Worktree not visible in UI');
    }
    
    await page.screenshot({ path: 'test-results/worktree-session-test.png', fullPage: true });
  });

  test('5. Clean Up - Delete Created Worktrees', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token');
      return;
    }
    
    console.log('🧹 Cleaning up worktrees...');
    
    const versions = ['V2', 'V3'];
    for (const version of versions) {
      const response = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok()) {
        console.log(`✅ Deleted ${version} worktree`);
      } else {
        console.log(`ℹ️ ${version} worktree not found or already deleted`);
      }
    }
    
    // Final verification
    const projectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (projectsResponse.ok()) {
      const projects = await projectsResponse.json();
      const worktreeCount = projects.filter(p => p.isWorktree).length;
      console.log(`🌳 Final worktree count: ${worktreeCount}`);
    }
  });
});