import { test, expect } from '@playwright/test';

test.describe('Worktree Creation Debug', () => {
  const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NTQyNjE5OTR9.5OUTML0dlNhB-_XYr2huDBGvw3bPFamj4lcw4mmz4Ys';

  test('DEBUG WORKTREE CREATION PROCESS', async ({ page }) => {
    console.log('🔍 DEBUGGING: Worktree creation process step by step');
    
    // STEP 1: Check initial state
    console.log('📊 Step 1: Checking initial state...');
    
    const initialResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const initialProjects = await initialResponse.json();
    console.log(`📋 Initial projects count: ${initialProjects.length}`);
    initialProjects.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
    });
    
    // STEP 2: Clean any existing V2
    console.log('\n🧹 Step 2: Cleaning existing V2...');
    
    const deleteResponse = await page.request.delete('http://localhost:3000/api/worktree/V2', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    console.log(`🗑️ Delete V2 response: ${deleteResponse.status()}`);
    
    // STEP 3: Wait and check state after deletion
    await page.waitForTimeout(2000);
    
    const afterDeleteResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const afterDeleteProjects = await afterDeleteResponse.json();
    const afterDeleteV2Count = afterDeleteProjects.filter(p => p.displayName === 'agendamente - V2').length;
    console.log(`📋 Projects after deletion: ${afterDeleteProjects.length} (V2 count: ${afterDeleteV2Count})`);
    
    // STEP 4: Create V2 worktree
    console.log('\n📝 Step 4: Creating V2 worktree...');
    
    const createPayload = {
      branch: 'feature/v2-debug-test',
      projectPath: '/Users/ggomes/IdeaProjects/agendamente',
      projectName: 'agendamente'
    };
    
    console.log('📋 Create payload:', createPayload);
    
    const createResponse = await page.request.post('http://localhost:3000/api/worktree/create/V2', {
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: createPayload
    });
    
    console.log(`✅ Create V2 response: ${createResponse.status()}`);
    
    if (!createResponse.ok()) {
      const errorText = await createResponse.text();
      console.log(`🚨 Create error: ${errorText}`);
    } else {
      const createData = await createResponse.json();
      console.log('📋 Create response data:', createData);
    }
    
    // STEP 5: Wait and check state after creation
    console.log('\n⏱️ Step 5: Waiting 5 seconds for creation to complete...');
    await page.waitForTimeout(5000);
    
    const afterCreateResponse = await page.request.get('http://localhost:3000/api/projects', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    const afterCreateProjects = await afterCreateResponse.json();
    const afterCreateV2Count = afterCreateProjects.filter(p => p.displayName === 'agendamente - V2').length;
    
    console.log(`📋 Projects after creation: ${afterCreateProjects.length} (V2 count: ${afterCreateV2Count})`);
    afterCreateProjects.forEach((p, i) => {
      console.log(`  ${i + 1}. "${p.displayName}" [${p.isWorktree ? 'WORKTREE' : 'BASE'}]`);
      if (p.displayName.includes('V2')) {
        console.log(`      🔍 V2 Project details:`);
        console.log(`          name: "${p.name}"`);
        console.log(`          path: "${p.path}"`);
        console.log(`          isWorktree: ${p.isWorktree}`);
      }
    });
    
    // STEP 6: Multiple API checks to see if it appears later
    console.log('\n🔄 Step 6: Multiple API checks...');
    
    for (let i = 1; i <= 3; i++) {
      await page.waitForTimeout(3000);
      
      const checkResponse = await page.request.get('http://localhost:3000/api/projects', {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
      });
      
      const checkProjects = await checkResponse.json();
      const checkV2Count = checkProjects.filter(p => p.displayName === 'agendamente - V2').length;
      console.log(`📊 Check ${i}: ${checkProjects.length} projects, ${checkV2Count} V2 projects`);
    }
    
    // STEP 7: Check filesystem (if possible)
    console.log('\n📂 Step 7: Checking worktrees directory...');
    
    try {
      const lsResponse = await page.request.get('http://localhost:3000/api/files', {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
        searchParams: { path: '/Users/ggomes/IdeaProjects/worktrees' }
      });
      
      if (lsResponse.ok()) {
        const lsData = await lsResponse.json();
        console.log('📂 Worktrees directory contents:', lsData);
      } else {
        console.log(`📂 Cannot access worktrees directory: ${lsResponse.status()}`);
      }
    } catch (error) {
      console.log(`📂 Error checking filesystem: ${error.message}`);
    }
    
    console.log('\n🎯 WORKTREE CREATION DEBUG RESULTS:');
    console.log('==================================');
    console.log(`📊 Initial V2 count: ${initialProjects.filter(p => p.displayName === 'agendamente - V2').length}`);
    console.log(`📊 After delete V2 count: ${afterDeleteV2Count}`);
    console.log(`📊 After create V2 count: ${afterCreateV2Count}`);
    console.log(`📊 Create response status: ${createResponse.status()}`);
    
    if (afterCreateV2Count === 0) {
      console.log('🚨 WORKTREE CREATION FAILED');
      console.log('   The V2 worktree was not created successfully');
    } else {
      console.log('✅ WORKTREE CREATION SUCCEEDED');
      console.log(`   ${afterCreateV2Count} V2 worktree(s) found after creation`);
    }
    
    console.log('✅ WORKTREE CREATION DEBUG COMPLETE');
  });
});