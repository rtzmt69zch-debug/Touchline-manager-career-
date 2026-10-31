import fs from 'node:fs';
import assert from 'node:assert/strict';
import {leagueData,europeanLeagues,allEuropeanClubs,starPlayers,roundRobin,createSeason,freshTable} from '../src/leagues.js';
import {createManager,acceptOffer,beginLiveMatch,advanceLiveMatch,closeSeason,resolvePlayoff,buyItem,shopItems,signPlayer,transferCandidates,generateYouthProspects,getTeamRatings,money} from '../src/engine.js';

assert.equal(leagueData[0].clubs.length,20,'Premier League has 20 clubs');
for(const l of leagueData.slice(1)) assert.equal(l.clubs.length,24,`${l.name} has 24 clubs`);
assert.equal(roundRobin(leagueData[0].clubs).length,38,'20-team double round robin has 38 rounds');
assert.equal(roundRobin(leagueData[1].clubs).length,46,'24-team double round robin has 46 rounds');
assert.ok(europeanLeagues.length>=8,'eight major overseas leagues are present');
assert.ok(allEuropeanClubs.length>=100,'European club database is populated');
assert.equal(starPlayers['맨체스터 시티'],'엘링 홀란','Manchester City star player is mapped');
assert.equal(starPlayers['맨체스터 유나이티드'],'브루노 페르난데스','Manchester United star player is mapped');

for(const route of ['legend','youth','license','unknown']){
  const initial=createManager(route,'게겐프레싱');
  assert.ok(initial.offers.length>=3&&initial.offers.length<=5,'3–5 manager offers');
  const gm=acceptOffer(initial,initial.offers[0].id);
  assert.ok(gm.club&&gm.salary>0&&gm.fixtures.length>=38,'offer acceptance initializes career');
  assert.equal(gm.table.length,gm.tier===1?20:24,'league table matches division size');
}

const manager=createManager('unknown','게겐프레싱');
let gm=acceptOffer(manager,manager.offers[0].id);
let matches=0;
while(matches<2){
 const started=beginLiveMatch(gm,{rotation:'부분 로테이션',press:'높은 압박',line:'높은 수비라인',tempo:'빠른 템포'});
 assert.ok(started.match,'live match starts');
 let live=started.match,done=null,guard=0;
 while(!done&&guard++<30){
   const step=advanceLiveMatch(gm,live);
   if(step.result){done=step;break;}
   live=step.match;
   if(live.prompt){const decision=advanceLiveMatch(gm,live,live.prompt.options[0]);live=decision.match;}
 }
 assert.ok(done,'match reaches full time');gm=done.gm;matches++;
}
assert.equal(gm.played,2,'league appearances update');
assert.ok(gm.lastResult.fanReactions.length>=3,'fan community reactions are generated per match');
const itemResult=buyItem(gm,shopItems[0]);
assert.ok(itemResult.gm||itemResult.error,'shop purchase returns valid state');
console.log('Smoke tests passed: league sizes, fixture rounds, manager offers, career initialization, live match flow and shop, European league database, club stars and fan reactions.');

// 해외 9개 리그 모두 1·2부를 보유하고, 시즌 종료 시 2개 구단씩 승강한다.
const {createEuropeanWorld,simulateEuropeanWorld}=await import('../src/leagues.js');
const world=createEuropeanWorld();
assert.equal(Object.keys(world).length,9);
for(const [name,league] of Object.entries(world)){
  const beforeTop=league.top.length,beforeSecond=league.second.length;
  const after=simulateEuropeanWorld({[name]:league},2)[name];
  assert.equal(after.lastMovement.filter(x=>x.direction==='승격').length,2,`${name} 승격 수`);
  assert.equal(after.lastMovement.filter(x=>x.direction==='강등').length,2,`${name} 강등 수`);
  assert.equal(after.top.length,beforeTop,`${name} 1부 팀 수 유지`);
  assert.equal(after.second.length,beforeSecond,`${name} 2부 팀 수 유지`);
}
console.log('European promotion/relegation simulation tests passed.');
const seasonReady={...gm,played:gm.tier===1?38:46,fixtures:[],fa:'탈락',carabao:'탈락',table:gm.table.map((r,i)=>({...r,p:gm.tier===1?38:46,pts:i===0?90:35,gf:50,ga:40}))};
const seasonResult=closeSeason(seasonReady);
assert.ok(seasonResult.gm?.europeanWorld,'season close persists overseas league world state');
assert.equal(seasonResult.gm.youthPool.length,5,'season close creates five selectable youth prospects');
assert.equal(seasonResult.gm.europeanMovementHistory.length,1,'season close records overseas promotion/relegation history');
console.log('Season close integration test passed.');

const featureManager=createManager('youth','점유율 축구');
const featureBase=acceptOffer(featureManager,featureManager.offers[0].id);
const target=featureBase.squad.find(p=>p.position==='공격');
const marketForward=transferCandidates(featureBase).find(p=>p.position==='공격'&&p.age===19);
const expectedBlend=Math.round((target.rating+marketForward.rating)/2);
const signed=signPlayer({...featureBase,transferBudget:100000000000},marketForward);
assert.equal(signed.gm.squad.find(p=>p.position==='공격').rating,expectedBlend,'new signing rating is averaged with replaced squad player');
assert.equal(generateYouthProspects({...featureBase,season:2}).length,5,'five academy prospects are generated each season');
const firstXI=beginLiveMatch(featureBase,{rotation:'주전 기용',formation:'4-3-3',press:'높은 압박',line:'높은 수비라인',tempo:'빠른 템포',width:'넓게'}).match;
const rotatedXI=beginLiveMatch(featureBase,{rotation:'대규모 로테이션',formation:'3-5-2',press:'중간 압박',line:'낮은 수비라인',tempo:'느린 템포',width:'보통'}).match;
assert.ok(rotatedXI.rotationRelief>firstXI.rotationRelief,'squad rotation provides extra stamina relief');
const strongAttack={...featureBase,squad:featureBase.squad.map(p=>p.position==='공격'?{...p,rating:99}:p)};
const strongAttackMatch=beginLiveMatch(strongAttack,{rotation:'부분 로테이션',formation:'4-3-3',press:'중간 압박',line:'중간 수비라인',tempo:'보통 템포',width:'보통'}).match;
assert.ok(strongAttackMatch.attackEdge>beginLiveMatch(featureBase,{rotation:'부분 로테이션',formation:'4-3-3',press:'중간 압박',line:'중간 수비라인',tempo:'보통 템포',width:'보통'}).match.attackEdge,'attacking player ratings influence attacking matchup');

assert.ok(getTeamRatings(featureBase).중원>0&&getTeamRatings(featureBase).수비>0,'team ratings are derived from attack, midfield and defence units');
const savedRandom=Math.random;Math.random=()=>.5;
const lowAcademy=generateYouthProspects({...featureBase,stats:{...featureBase.stats,유소년육성:20}});
const highAcademy=generateYouthProspects({...featureBase,stats:{...featureBase.stats,유소년육성:90}});
assert.ok(highAcademy.reduce((a,p)=>a+p.potential,0)>lowAcademy.reduce((a,p)=>a+p.potential,0),'youth development skill improves prospect potential');
function simulateForStats(state,opts){let live=beginLiveMatch(state,opts).match,done=null,guard=0;while(!done&&guard++<30){const step=advanceLiveMatch(state,live,live.prompt?.options?.[0]);if(step.result)done=step;else live=step.match;}return done;}
const neutralOpts={rotation:'부분 로테이션',formation:'4-3-3',press:'중간 압박',line:'중간 수비라인',tempo:'보통 템포',width:'보통'};
const baselineStats=simulateForStats(featureBase,neutralOpts).result.stats;
const attackingStats=simulateForStats(strongAttack,neutralOpts).result.stats;
assert.ok(attackingStats.shots>baselineStats.shots&&attackingStats.xg>baselineStats.xg,'attacking unit quality changes shots and expected goals');
const slowStats=simulateForStats(featureBase,{...neutralOpts,tempo:'느린 템포'}).result.stats;
const fastStats=simulateForStats(featureBase,{...neutralOpts,tempo:'빠른 템포'}).result.stats;
assert.ok(slowStats.possession>fastStats.possession&&fastStats.shots>slowStats.shots,'tempo changes possession and shot volume');
Math.random=savedRandom;

// Match engine regression: missing momentum previously made the goal probability NaN,
// silently preventing either side from scoring. Verify normal match scoring and post-match payloads.
const momentumCheck=beginLiveMatch(featureBase,neutralOpts).match;
assert.equal(momentumCheck.momentum,0,'live match initializes momentum at zero');
let totalGoals=0,scoredMatches=0,zeroZeroMatches=0,postMatchPayloads=0;
const scoringSample=100;
for(let i=0;i<scoringSample;i++){
 const outcome=simulateForStats(featureBase,neutralOpts);
 totalGoals+=outcome.result.gf+outcome.result.ga;
 if(outcome.result.gf+outcome.result.ga>0)scoredMatches++;
 if(outcome.result.gf===0&&outcome.result.ga===0)zeroZeroMatches++;
 assert.ok(outcome.result.stats?.possession!==undefined,'full-time result includes match statistics');
 assert.ok(outcome.gm.interview?.questions?.length===2,'full-time result includes two press-conference questions');
 assert.ok(outcome.gm.lastResult?.stats?.shotsOnTarget!==undefined,'saved match report includes shots on target');
 postMatchPayloads++;
}
const averageGoals=totalGoals/scoringSample;
assert.ok(averageGoals>2.2&&averageGoals<4.5,`average total goals should be lively but plausible (actual ${averageGoals.toFixed(2)})`);
assert.ok(scoredMatches>=85,`most matches should contain goals (actual ${scoredMatches}/${scoringSample})`);
assert.ok(zeroZeroMatches<=8,`0-0 results should be uncommon (actual ${zeroZeroMatches}/${scoringSample})`);
for(const portrait of ['youth.png','prime.png','veteran.png','reporter-1.png','reporter-2.png','reporter-3.png'])assert.ok(fs.existsSync(new URL(`../public/players/${portrait}`,import.meta.url)),'bundled player/reporter portrait exists: '+portrait);
const uiSource=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.ok(uiSource.includes("postMatchStage==='stats'"),'full-time statistics have a dedicated screen before the press conference');
assert.ok(uiSource.includes("setPostMatchStage('interview')")&&uiSource.includes("setTab('기자회견')"),'statistics confirmation opens the press conference');
assert.ok(uiSource.includes("postMatchStage:next.interview?'interview':'complete'"),'press-conference progress is saved with the career');
assert.ok(fs.readFileSync(new URL('../src/engine.js',import.meta.url),'utf8').includes("'prime'}.png"),'transfer portraits use the bundled PNG files');
assert.ok(uiSource.includes("tab==='기자회견'"),'press conference is rendered as its own screen');
console.log(`Match-flow regression passed: ${averageGoals.toFixed(2)} average total goals, ${scoredMatches}/${scoringSample} matches with goals, ${zeroZeroMatches}/${scoringSample} 0-0 results, stats and press conference payloads present.`);
console.log('Feature tests passed: averaged signings, five youth prospects, rotation stamina relief, positional tactical effects and local player portraits.');

// Currency display regression: compact Korean units, numeric unit labels, max two significant digits.
assert.equal(money(100000000000),'1000억','one thousand hundred-million won is shown as 1000억');
assert.equal(money(12345678900),'120억','large amounts are rounded to two significant digits');
assert.equal(money(1234567890000),'1.2조','trillion amounts use 조 and two significant digits');
assert.equal(money(1234567),'120만','mid-sized amounts use 만 and two significant digits');
assert.equal(money(5000),'5,000원','small amounts retain won notation');
console.log('Currency formatting tests passed: numeric Korean units and two significant digits.');
