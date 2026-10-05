import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
describe('private together calendar',()=>{
it('is discoverable and keeps personal data outside public source',async()=>{const home=await readFile('index.html','utf8'),html=await readFile('calendar/index.html','utf8'),js=await readFile('calendar/planner.js','utf8');expect(home).toContain('href="calendar/"');expect(html).toContain('Our calendar');expect(html).toContain('no-referrer');expect(html).not.toContain('Toni Nagy');expect(js).toContain('location.hash');});
it('provides editing, separate schedules, flexible trip hours, agenda and print views',async()=>{const html=await readFile('calendar/index.html','utf8');for(const text of ['Partner · work','Thomas · work','Together','id="event-form"','id="agenda"','id="print"','id="revoke"'])expect(html).toContain(text);});
});