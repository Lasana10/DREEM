import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const root=process.env.DREEM_SMOKE_URL??"http://127.0.0.1:4173/";
await mkdir("mobile-smoke-artifacts",{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const device of [
   {name:"android-phone",viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2},
   {name:"narrow-phone",viewport:{width:320,height:690},isMobile:true,hasTouch:true,deviceScaleFactor:2},
   {name:"desktop",viewport:{width:1280,height:800},isMobile:false,hasTouch:false,deviceScaleFactor:1}
 ]){
   const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:device.deviceScaleFactor,locale:"en-CM"});
   const page=await context.newPage();
   const pageErrors=[];
   page.on("pageerror",error=>pageErrors.push(error.message));
   const response=await page.goto(root,{waitUntil:"domcontentloaded",timeout:30000});
   assert(response?.ok(),device.name+": application must respond successfully");
   await page.locator("#root").waitFor({state:"visible",timeout:15000});
   await page.waitForTimeout(1000);
   const metrics=await page.evaluate(()=>({
     bodyText:document.body.innerText.trim().length,
     contentWidth:document.documentElement.scrollWidth,
     viewportWidth:document.documentElement.clientWidth,
     rootElements:document.querySelector("#root")?.childElementCount??0,
   }));
   assert(metrics.rootElements>0,device.name+": React app must mount");
   assert(metrics.bodyText>15,device.name+": UI must render readable content, not an empty shell");
   assert(metrics.contentWidth<=metrics.viewportWidth+4,device.name+": horizontal overflow "+JSON.stringify(metrics));
   assert.equal(pageErrors.length,0,device.name+": uncaught browser exceptions: "+pageErrors.join("; "));
   await page.screenshot({path:"mobile-smoke-artifacts/"+device.name+".png",fullPage:true});
   console.log(device.name+": smoke passed "+JSON.stringify(metrics));
   await context.close();
 }
}finally{await browser.close();}
