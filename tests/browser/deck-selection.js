// Playwright CLI regression. Start on an authenticated landing page:
// node node_modules/@playwright/cli/playwright-cli.js -s=<session> run-code --filename tests/browser/deck-selection.js
async(page)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const selector=page.locator('#deck-choice');await selector.waitFor();
 const expected=['random','aggro','defense','control','healing','sacrifice','empower','combo'];
 const values=await selector.locator('option').evaluateAll(options=>options.map(option=>option.value));
 if(JSON.stringify(values)!==JSON.stringify(expected))throw new Error('Preset choices missing');
 for(const [width,height] of [[1920,1080],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);if(!await selector.isVisible())throw new Error('Deck selector hidden');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Horizontal overflow')}
 await page.setViewportSize({width:1920,height:1080});await selector.selectOption('control');const firstName=await selector.locator('option:checked').innerText();
 await page.getByRole('button',{name:'Påbörja duell',exact:true}).click();const intro=page.getByRole('button',{name:'Jag börjar',exact:true});if(await intro.count())await intro.click();await page.locator('.left-rail').getByText(firstName,{exact:true}).waitFor();
 // Finish a real match by passing turns; the bot plays through the normal engine.
 const deadline=Date.now()+180000;
 while(!await page.locator('.game-over').count()&&Date.now()<deadline){const next=page.locator('.next-button');if(!await next.isDisabled())await next.click();await page.waitForTimeout(100)}
 if(!await page.locator('.game-over').count())throw new Error('Match did not finish');
 await page.getByRole('button',{name:'Spela igen',exact:true}).click();await page.locator('#restart-deck-choice').waitFor();
 if(!await page.locator('#restart-deck-choice').isVisible())throw new Error('Replay bypassed deck choice');
 await page.getByRole('button',{name:'Tillbaka',exact:true}).click();await page.getByRole('button',{name:'Spela igen',exact:true}).waitFor();
 await page.getByRole('button',{name:'Spela igen',exact:true}).click();const replaySelector=page.locator('#restart-deck-choice');await replaySelector.selectOption('healing');const secondName=await replaySelector.locator('option:checked').innerText();
 await page.getByRole('button',{name:'Starta ny match',exact:true}).click();await page.locator('.left-rail').getByText(secondName,{exact:true}).waitFor();if(await page.locator('.game-over').count())throw new Error('Old result remained');
 await page.locator('.preparation-note').waitFor();if(errors.length)throw new Error(errors.join(';'));
 return{choices:7,firstSelectedDeck:firstName,replaySelectedDeck:secondName,replayRequiresChoice:true,cancelPreservesResult:true,mobile:true,pageErrors:errors};
}
