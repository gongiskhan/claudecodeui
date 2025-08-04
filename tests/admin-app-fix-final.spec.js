import { test, expect } from '@playwright/test';

test.describe('Admin-App Fix - Final Verification', () => {
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

  test('1. Clean All Admin-App Projects Before Test', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Pre-test cleanup of admin-app projects...');
    
    // Get all projects
    const response = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const projects = await response.json();
    const adminAppProjects = projects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`🔍 Found ${adminAppProjects.length} admin-app projects to clean up`);
    
    if (adminAppProjects.length > 0) {
      console.log('🚨 Admin-app projects found before test:');
      adminAppProjects.forEach(p => {
        console.log(`  - DisplayName: ${p.displayName}, Name: ${p.name}, Path: ${p.path}`);
      });
    }
  });

  test('2. Create V2 Worktree and Verify Naming', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🌳 Creating V2 worktree and testing naming...');
    
    // Create V2 worktree
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v2-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (createResponse.ok()) {
      console.log('✅ V2 worktree created successfully');
    } else {
      const error = await createResponse.text();
      console.log('ℹ️ V2 worktree creation result:', createResponse.status(), error);
    }
    
    // Wait a moment for the system to process
    await page.waitForTimeout(2000);
    
    // Get all projects after creation
    const projectsResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    expect(projectsResponse.ok()).toBeTruthy();
    const projects = await projectsResponse.json();
    
    console.log('📋 All projects after V2 creation:');
    projects.forEach(p => {
      console.log(`  - DisplayName: "${p.displayName}", Name: "${p.name}", Worktree: ${p.isWorktree || false}`);
    });
    
    // Verify NO admin-app projects exist
    const adminAppProjects = projects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`🔍 Admin-app projects after V2 creation: ${adminAppProjects.length}`);
    expect(adminAppProjects.length).toBe(0);
    
    // Verify we have the correct V2 worktree
    const v2Projects = projects.filter(p => 
      p.displayName === 'agendamente - V2' && p.isWorktree === true
    );
    
    console.log(`🔍 Correct agendamente - V2 projects: ${v2Projects.length}`);
    expect(v2Projects.length).toBe(1);
    
    if (v2Projects.length > 0) {
      console.log('✅ V2 worktree has correct naming:');
      console.log(`  - DisplayName: "${v2Projects[0].displayName}"`);
      console.log(`  - Path: "${v2Projects[0].path}"`);
    }
  });

  test('3. Test UI Load with Worktree', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🖥️ Testing UI load with worktree projects...');
    
    // Navigate to UI and set auth
    await page.goto('http://localhost:3001');
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, authToken);
    await page.reload();
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/admin-app-fix-final.png', fullPage: true });
    
    // Check page content
    const pageText = await page.textContent('body');
    
    // Should NOT contain admin-app
    const hasAdminApp = pageText.includes('admin-app');
    console.log('🔍 Page contains admin-app:', hasAdminApp);
    expect(hasAdminApp).toBe(false);
    
    // Should contain agendamente - V2
    const hasV2Worktree = pageText.includes('agendamente - V2');
    console.log('🔍 Page contains agendamente - V2:', hasV2Worktree);
    expect(hasV2Worktree).toBe(true);
    
    if (hasV2Worktree) {
      console.log('✅ UI correctly shows agendamente - V2 worktree');
    }
  });

  test('4. Create V3 Worktree and Test No Admin-App Creation', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🌳 Creating V3 worktree to test no admin-app creation...');
    
    // Get project count before
    let beforeResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const beforeProjects = await beforeResponse.json();
    const beforeAdminApp = beforeProjects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`📊 Before V3 creation - Admin-app projects: ${beforeAdminApp.length}`);
    
    // Create V3 worktree
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V3', {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        branch: 'feature/v3-test',
        projectPath: '/Users/ggomes/IdeaProjects/agendamente',
        projectName: 'agendamente'
      }
    });
    
    if (createResponse.ok()) {
      console.log('✅ V3 worktree created successfully');
    } else {
      console.log('ℹ️ V3 worktree creation result:', createResponse.status());
    }
    
    await page.waitForTimeout(2000);
    
    // Get project count after
    let afterResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const afterProjects = await afterResponse.json();
    const afterAdminApp = afterProjects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log(`📊 After V3 creation - Admin-app projects: ${afterAdminApp.length}`);
    
    // Verify no new admin-app projects were created
    expect(afterAdminApp.length).toBe(beforeAdminApp.length);
    
    // Verify V3 worktree was created correctly
    const v3Projects = afterProjects.filter(p => 
      p.displayName === 'agendamente - V3' && p.isWorktree === true
    );
    
    console.log(`🔍 Correct agendamente - V3 projects: ${v3Projects.length}`);
    expect(v3Projects.length).toBe(1);
    
    console.log('✅ V3 creation did not create any admin-app projects');
  });

  test('5. Cleanup and Final Verification', async ({ page }) => {
    if (!authToken) {
      test.skip('No auth token available');
      return;
    }

    console.log('🧹 Final cleanup and verification...');
    
    // Delete test worktrees
    const versions = ['V2', 'V3'];
    for (const version of versions) {
      const deleteResponse = await page.request.delete(`http://localhost:3000/api/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (deleteResponse.ok()) {
        console.log(`✅ Deleted ${version} worktree`);
      } else {
        console.log(`ℹ️ ${version} worktree deletion result:`, deleteResponse.status());
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Final verification - NO admin-app projects should exist
    const finalResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const finalProjects = await finalResponse.json();
    const finalAdminApp = finalProjects.filter(p => 
      p.displayName === 'admin-app' || p.name === 'admin-app'
    );
    
    console.log('📋 Final project state:');
    finalProjects.forEach(p => {
      console.log(`  - "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
    });
    
    console.log(`🎯 Final admin-app count: ${finalAdminApp.length}`);
    expect(finalAdminApp.length).toBe(0);
    
    console.log('🎉 SUCCESS: Admin-app bug is completely fixed!');
  });
});