const fetch = require('node-fetch');

async function test() {
  const apiKey = 'cwG38owB6JPGD6YMF5VhTfrAeBn2';
  const url = 'https://api.scrapecreators.com/v1/linkedin/profile?url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Farpit-ratan-a2aaa120';

  console.log('Fetching Arpit Ratan profile...');
  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Root keys:', Object.keys(data));
    
    // Dump some details about posts/activity/updates/articles/comments
    console.log('posts count:', data.posts?.length || 0);
    console.log('recentPosts count:', data.recentPosts?.length || 0);
    console.log('activity count:', data.activity?.length || 0);
    console.log('updates count:', data.updates?.length || 0);
    console.log('articles count:', data.articles?.length || 0);
    console.log('comments count:', data.comments?.length || 0);
    
    if (data.posts && data.posts.length > 0) {
      console.log('Sample post:', JSON.stringify(data.posts[0]).slice(0, 200));
    }
    if (data.recentPosts && data.recentPosts.length > 0) {
      console.log('Sample recentPost:', JSON.stringify(data.recentPosts[0]).slice(0, 200));
    }
    if (data.activity && data.activity.length > 0) {
      console.log('Sample activity:', JSON.stringify(data.activity[0]).slice(0, 200));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
