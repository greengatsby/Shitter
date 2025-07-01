#!/usr/bin/env node
/**
 * Test script to verify GitHub App repository fetching
 * Usage: INSTALLATION_ID=73902253 node test-github-repos.js
 */

const { createAppAuth } = require('@octokit/auth-app');
const { Octokit } = require('@octokit/rest');

const {
  GH_APP_ID,
  GH_APP_PK,
  INSTALLATION_ID,
} = process.env;


if (!GH_APP_ID || !GH_APP_PK || !INSTALLATION_ID) {
  console.error('❌ Set GH_APP_ID, GH_APP_PK and INSTALLATION_ID env vars');
  process.exit(1);
}

async function testRepoFetching() {
  try {
    console.log('🚀 Testing GitHub App repository fetching...\n');

    // 1️⃣ Create app auth instance
    const auth = createAppAuth({
      appId: Number(GH_APP_ID),
      privateKey: GH_APP_PK.replace(/\\n/g, '\n'),
    });

    // 2️⃣ Get installation token
    console.log('⏳ Getting installation token...');
    const { token } = await auth({
      type: 'installation',
      installationId: Number(INSTALLATION_ID),
    });
    console.log('✅ Installation token obtained\n');

    // 3️⃣ Create Octokit instance
    const octokit = new Octokit({ auth: token });

    // 4️⃣ List repositories with pagination
    console.log('⏳ Fetching repositories...');
    const repos = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      {
        per_page: 100,
      }
    );

    console.log(`✅ Installation ${INSTALLATION_ID} has access to ${repos.length} repos:\n`);
    
    repos.forEach((repo, index) => {
      console.log(`${index + 1}. ${repo.full_name} (${repo.private ? 'private' : 'public'})`);
      console.log(`   Description: ${repo.description || 'No description'}`);
      console.log(`   Language: ${repo.language || 'N/A'}`);
      console.log(`   Updated: ${repo.updated_at}`);
      console.log('');
    });

    console.log('🎉 GitHub App integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ GitHub App test failed:', error.message);
    process.exit(1);
  }
}

testRepoFetching(); 