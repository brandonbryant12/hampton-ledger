import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',timeout:30000,fullyParallel:false,workers:2,retries:0,
 reporter:[['list'],['html',{open:'never',outputFolder:'artifacts/playwright-report'}]],
 use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4178',viewport:{width:1440,height:1000},trace:'retain-on-failure'},
 webServer:process.env.TEST_BASE_URL?undefined:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4178',reuseExistingServer:!process.env.CI,timeout:30000}
});
