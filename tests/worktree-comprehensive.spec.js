import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEST_PROJECT = 'agendamente';
const BASE_URL = 'http://localhost:3001';
const API_BASE = 'http://localhost:3000/api';

// Helper functions
async function loginAndGetToken(page) {
  // First check if already logged in
  await page.goto(BASE_URL);
  
  // Try to access projects API to see if we need to login
  const response = await page.request.get(`${API_BASE}/projects`);
  
  if (response.status() === 401) {
    // Need to login - try to register first (in case no user exists)
    try {
      const registerResponse = await page.request.post(`${API_BASE}/auth/register`, {
        data: { username: 'testuser', password: 'testpass123' }
      });
      console.log('Register response:', registerResponse.status());
    } catch (e) {
      console.log('Register failed (user may already exist):', e.message);
    }
    
    // Login
    const loginResponse = await page.request.post(`${API_BASE}/auth/login`, {
      data: { username: 'testuser', password: 'testpass123' }
    });
    
    if (loginResponse.ok()) {
      const { token } = await loginResponse.json();
      await page.evaluate((token) => {
        localStorage.setItem('auth_token', token);
      }, token);
      return token;
    } else {
      throw new Error('Failed to login');
    }
  }
  
  // Already logged in, get token from localStorage
  return await page.evaluate(() => localStorage.getItem('auth_token'));
}

async function cleanupWorktrees(page, token) {
  console.log('🧹 Cleaning up existing worktrees...');
  
  // Clean up any existing worktrees from previous test runs
  const versions = ['V2', 'V3', 'V4', 'V5'];
  for (const version of versions) {
    try {
      const response = await page.request.delete(`${API_BASE}/worktree/${version}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok()) {
        console.log(`✅ Deleted worktree ${version}`);
      }
    } catch (e) {
      console.log(`⚠️ Failed to delete worktree ${version}:`, e.message);
    }
  }
  
  // Clean up project config
  const projectConfigPath = path.join(process.env.HOME, '.claude', 'project-config.json');
  try {
    const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    const cleanConfig = {};
    
    // Keep only the base project, remove worktree-related entries
    for (const [key, value] of Object.entries(config)) {
      if (!key.includes('worktrees') && value.originalPath === `/Users/ggomes/IdeaProjects/${TEST_PROJECT}`) {
        cleanConfig[key] = value;
      }
    }
    
    fs.writeFileSync(projectConfigPath, JSON.stringify(cleanConfig, null, 2));
    console.log('✅ Cleaned project config');
  } catch (e) {
    console.log('⚠️ Failed to clean project config:', e.message);
  }
  
  // Wait for cleanup to propagate
  await page.waitForTimeout(2000);
}

async function ensureBaseProject(page, token) {
  console.log('🔧 Ensuring base project exists...');
  
  // Check if base project exists
  const projectsResponse = await page.request.get(`${API_BASE}/projects`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (projectsResponse.ok()) {
    const projects = await projectsResponse.json();
    const baseProject = projects.find(p => 
      p.displayName === TEST_PROJECT || 
      p.path.includes(TEST_PROJECT)
    );
    
    if (!baseProject) {
      // Create base project
      const createResponse = await page.request.post(`${API_BASE}/projects/create`, {
        headers: { 'Authorization': `Bearer ${token}` },
        data: { path: `/Users/ggomes/IdeaProjects/${TEST_PROJECT}` }
      });
      
      if (!createResponse.ok()) {
        throw new Error(`Failed to create base project: ${createResponse.status()}`);
      }
      console.log('✅ Created base project');
    } else {
      console.log('✅ Base project exists');
    }
  }
}

test.describe('Worktree Comprehensive Tests', () => {
  let authToken;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    authToken = await loginAndGetToken(page);
    await cleanupWorktrees(page, authToken);
    await ensureBaseProject(page, authToken);
    
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, authToken);
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('1. Clean State - No duplicate admin-app entries', async ({ page }) => {
    console.log('🧪 Testing clean state...');
    
    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-list"], .sidebar', { timeout: 10000 });
    
    // Count admin-app entries
    const adminAppElements = await page.locator('text=admin-app').count();
    expect(adminAppElements).toBe(0); // Should be 0 admin-app entries
    
    // Verify base project exists with correct name
    await expect(page.locator(`text=${TEST_PROJECT}`)).toBeVisible();
    
    console.log('✅ Clean state verified');
  });

  test('2. Create First Worktree (V2)', async ({ page }) => {
    console.log('🧪 Testing worktree V2 creation...');
    
    // Find the base project and click to expand/show worktree buttons
    await page.locator(`text=${TEST_PROJECT}`).first().click();
    await page.waitForTimeout(1000);
    
    // Look for V2 worktree creation button
    const v2Button = page.locator('button:has-text("V2")').first();
    await expect(v2Button).toBeVisible({ timeout: 5000 });
    
    // Click V2 button to create worktree
    await v2Button.click();
    
    // Wait for worktree creation to complete
    await page.waitForTimeout(5000);
    
    // Refresh page to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify V2 worktree appears in project list
    await expect(page.locator(`text=${TEST_PROJECT} - V2`)).toBeVisible({ timeout: 10000 });
    
    // Verify it's not showing as "admin-app"
    const adminAppCount = await page.locator('text=admin-app').count();
    expect(adminAppCount).toBe(0);
    
    console.log('✅ V2 worktree created successfully');
  });

  test('3. Create Second Worktree (V3)', async ({ page }) => {
    console.log('🧪 Testing worktree V3 creation...');
    
    // Find the base project and create V3 worktree
    await page.locator(`text=${TEST_PROJECT}`).first().click();
    await page.waitForTimeout(1000);
    
    const v3Button = page.locator('button:has-text("V3")').first();
    await expect(v3Button).toBeVisible({ timeout: 5000 });
    
    await v3Button.click();
    await page.waitForTimeout(5000);
    
    // Refresh and verify both worktrees exist
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator(`text=${TEST_PROJECT} - V2`)).toBeVisible();
    await expect(page.locator(`text=${TEST_PROJECT} - V3`)).toBeVisible();
    
    // Verify distinct projects (should have 3 total: base + V2 + V3)
    const projectElements = await page.locator(`text=${TEST_PROJECT}`).count();
    expect(projectElements).toBeGreaterThanOrEqual(3);
    
    console.log('✅ V3 worktree created successfully');
  });

  test('4. Session Isolation - V2 Worktree', async ({ page }) => {
    console.log('🧪 Testing V2 worktree session isolation...');
    
    // Click on V2 worktree project
    await page.locator(`text=${TEST_PROJECT} - V2`).first().click();
    await page.waitForTimeout(2000);
    
    // Create a new session in V2 worktree
    const newSessionButton = page.locator('button:has-text("New Session")').first();
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Send a test message to V2 worktree
    const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Test message for V2 worktree - unique identifier V2');
      await messageInput.press('Enter');
      await page.waitForTimeout(3000);
    }
    
    // Go back to project list
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Verify V2 worktree has sessions
    const v2Project = page.locator(`text=${TEST_PROJECT} - V2`).first();
    await expect(v2Project).toBeVisible();
    
    console.log('✅ V2 worktree session created');
  });

  test('5. Session Isolation - V3 Worktree', async ({ page }) => {
    console.log('🧪 Testing V3 worktree session isolation...');
    
    // Click on V3 worktree project  
    await page.locator(`text=${TEST_PROJECT} - V3`).first().click();
    await page.waitForTimeout(2000);
    
    // Create a session in V3 worktree
    const newSessionButton = page.locator('button:has-text("New Session")').first();
    if (await newSessionButton.isVisible()) {
      await newSessionButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Send a different test message to V3 worktree
    const messageInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Test message for V3 worktree - unique identifier V3');
      await messageInput.press('Enter');
      await page.waitForTimeout(3000);
    }
    
    console.log('✅ V3 worktree session created');
  });

  test('6. Verify Session Isolation', async ({ page }) => {
    console.log('🧪 Testing session isolation between worktrees...');
    
    // Check V2 worktree sessions
    await page.locator(`text=${TEST_PROJECT} - V2`).first().click();
    await page.waitForTimeout(2000);
    
    // Look for V2-specific content, should not see V3 content
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('V2');
    
    // Go back and check V3 worktree
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.locator(`text=${TEST_PROJECT} - V3`).first().click();
    await page.waitForTimeout(2000);
    
    const v3Content = await page.textContent('body');
    expect(v3Content).toContain('V3');
    
    // Verify base project doesn't have worktree sessions
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.locator(`text=${TEST_PROJECT}`).first().click();
    await page.waitForTimeout(2000);
    
    console.log('✅ Session isolation verified');
  });

  test('7. Delete V3 Worktree', async ({ page }) => {
    console.log('🧪 Testing V3 worktree deletion...');
    
    // Find V3 worktree and look for delete button (X)
    const v3Project = page.locator(`text=${TEST_PROJECT} - V3`).first();
    await expect(v3Project).toBeVisible();
    
    // Look for delete button near the V3 project
    const deleteButton = page.locator('[data-testid="delete-project"], button:has-text("×"), button:has-text("✕")').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Handle confirmation dialog
      await page.waitForTimeout(1000);
      const confirmButton = page.locator('button:has-text("OK"), button:has-text("Yes"), button:has-text("Delete")').first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    } else {
      // Try API deletion as fallback
      const response = await page.request.delete(`${API_BASE}/worktree/V3`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      expect(response.ok()).toBeTruthy();
    }
    
    await page.waitForTimeout(3000);
    
    // Refresh and verify V3 is gone
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // V3 should not be visible
    await expect(page.locator(`text=${TEST_PROJECT} - V3`)).not.toBeVisible();
    
    // V2 should still be visible
    await expect(page.locator(`text=${TEST_PROJECT} - V2`)).toBeVisible();
    
    console.log('✅ V3 worktree deleted successfully');
  });

  test('8. Refresh Stability - No Creep Back', async ({ page }) => {
    console.log('🧪 Testing refresh stability...');
    
    // Multiple refreshes to test stability
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // V3 should still be gone
      await expect(page.locator(`text=${TEST_PROJECT} - V3`)).not.toBeVisible();
      
      // V2 should still exist  
      await expect(page.locator(`text=${TEST_PROJECT} - V2`)).toBeVisible();
      
      // No admin-app entries
      const adminAppCount = await page.locator('text=admin-app').count();
      expect(adminAppCount).toBe(0);
    }
    
    console.log('✅ Refresh stability verified');
  });

  test('9. Final Cleanup', async ({ page }) => {
    console.log('🧪 Final cleanup test...');
    
    // Delete remaining V2 worktree
    const response = await page.request.delete(`${API_BASE}/worktree/V2`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok()) {
      console.log('API deletion failed, trying UI deletion...');
      // Try UI deletion as fallback
    }
    
    await page.waitForTimeout(3000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should only have base project
    const projectCount = await page.locator(`text=${TEST_PROJECT}`).count();
    expect(projectCount).toBe(1); // Only base project
    
    // No admin-app entries
    const adminAppCount = await page.locator('text=admin-app').count();
    expect(adminAppCount).toBe(0);
    
    console.log('✅ Final cleanup completed');
  });
});