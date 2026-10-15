import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMarineObservations } from '../frontend/src/marine-observation-diff.ts';

test('跨日對照只描述節目出現與時段差異，不把缺席解讀成取消', () => {
  const before = [
    {sourceKey:'a',title:'大洋池',dailySchedule:[{localTime:'13:00'},{localTime:'10:00'}]},
    {sourceKey:'b',title:'海豹',dailySchedule:[{localTime:'11:00'}]},
    {sourceKey:'stable',title:'穩定節目',dailySchedule:[{localTime:'12:00'}]},
  ];
  const after = [
    {sourceKey:'a',title:'大洋池',dailySchedule:[{localTime:'10:00'},{localTime:'14:00'}]},
    {sourceKey:'c',title:'企鵝',dailySchedule:[{localTime:'15:00'}]},
    {sourceKey:'stable',title:'穩定節目',dailySchedule:[{localTime:'12:00'}]},
  ];
  assert.deepEqual(compareMarineObservations(before,after),[
    {key:'a',title:'大洋池',kind:'times_changed',before:['10:00','13:00'],after:['10:00','14:00']},
    {key:'b',title:'海豹',kind:'removed',before:['11:00'],after:[]},
    {key:'c',title:'企鵝',kind:'added',before:[],after:['15:00']},
  ]);
  assert.equal(before[0].dailySchedule[0].localTime,'13:00','比較不能改變既有快照順序');
});
