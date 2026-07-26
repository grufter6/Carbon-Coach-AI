# Carbon Coach

An AI-powered personal carbon-reducer app. Recommends the best way to get
around each day (walk, bike, transit, drive) based on live routing data,
air quality, heat, and your personal transportation access and preferences.

## Deploy this on Vercel
1. Push this repo to GitHub.
2. Go to vercel.com, click "Add New" -> "Project," and import this repo.
3. Leave all settings as default and click Deploy.
4. Once deployed, copy your live URL (e.g. https://your-project.vercel.app).
5. Go to console.cloud.google.com/apis/credentials, open the OAuth Client ID
   used in index.html, and add your live URL under "Authorized JavaScript
   origins" (no trailing slash). Save and wait a few minutes before testing
   sign-in on the live site.

## Note on API keys
The OpenRouteService and OpenWeatherMap keys in index.html are visible to
anyone who views this page's source. Fine for a class prototype — before a
real public launch, move those calls behind a small server/serverless
function so the keys aren't exposed to visitors.
