import {chromium, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {finishOnboarding} from './onboard.mjs';
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
let calls=0;const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/api/january',route=>{calls++;return route.abort();});
try {
 await page.goto(process.env.NOURI_TEST_ORIGIN||'http://localhost:8085',{waitUntil:'networkidle'});
 await finishOnboarding(page);
 const add=page.getByRole('button',{name:'Add water',exact:true});await add.click();await add.click();await add.click();
 const total=page.getByTestId('water-total');await expect(total).toHaveText('24 fl oz (3 cups)');
 await page.reload({waitUntil:'networkidle'});await expect(total).toHaveText('24 fl oz (3 cups)');
 const covered=await total.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !top||!el.contains(top);});
 if(covered)throw Error('Water amount is obscured by navigation');
 await page.screenshot({path:'docs/screenshots/home-glass-mobile.png'});
 const card=total.locator('xpath=../../..');
 await card.evaluate(el=>el.scrollIntoView({block:'center'}));
 await card.screenshot({path:'docs/screenshots/water.png'});
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'Quick add meal',exact:true}).scrollIntoViewIfNeeded();
 await page.waitForTimeout(350);
 await page.screenshot({path:'docs/screenshots/glass-production.png'});
 if(calls||errors.length)throw Error(JSON.stringify({calls,errors}));
 console.log('LOCAL UI PASSED; persistent water amount is unobscured; no API calls or console errors');
} finally {await browser.close();}
