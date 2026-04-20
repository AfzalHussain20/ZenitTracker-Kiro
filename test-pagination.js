// Test script to verify Jira pagination is working
async function testPagination() {
  console.log('Testing Jira API pagination...\n');
  
  const baseUrl = 'http://localhost:3000';
  let startAt = 0;
  const batchSize = 100;
  let totalFetched = 0;
  let batchCount = 0;
  const maxBatches = 5; // Test first 5 batches
  
  while (batchCount < maxBatches) {
    try {
      console.log(`\nFetching batch ${batchCount + 1}...`);
      console.log(`  startAt: ${startAt}, maxResults: ${batchSize}`);
      
      const response = await fetch(`${baseUrl}/api/jira/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxResults: batchSize,
          startAt,
          issueType: 'Bug',
        }),
      });
      
      if (!response.ok) {
        console.error(`  ❌ HTTP ${response.status}: ${response.statusText}`);
        const errorText = await response.text();
        console.error(`  Error: ${errorText}`);
        break;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error(`  ❌ API Error: ${data.error}`);
        break;
      }
      
      const batchIssues = data.issues || [];
      totalFetched += batchIssues.length;
      
      console.log(`  ✅ Fetched ${batchIssues.length} issues`);
      console.log(`  Total so far: ${totalFetched}`);
      console.log(`  Total available: ${data.total}`);
      console.log(`  Has more: ${data.hasMore}`);
      
      if (!data.hasMore || batchIssues.length === 0) {
        console.log('\n✅ Reached end of results');
        break;
      }
      
      startAt += batchSize;
      batchCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      break;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Batches fetched: ${batchCount}`);
  console.log(`  Total issues: ${totalFetched}`);
}

// Run the test
testPagination().catch(console.error);
