import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('ticket migration preserves existing entries and generates unique, non-reused ticket numbers',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync('drizzle/0000_supreme_leper_queen.sql','utf8'));
 db.exec("INSERT INTO entries(id,room,user,name,status,joined) VALUES('legacy','room','guest','encrypted-name','waiting',1)");
 db.exec(readFileSync('drizzle/0001_silent_the_hood.sql','utf8'));
 const entry=db.prepare('SELECT * FROM entries').get();assert.equal(entry.name,'encrypted-name');assert.equal(entry.accepted_by,null);assert.equal(entry.admitted_at,null);
 db.prepare('INSERT INTO tickets(entry) VALUES(?)').run('legacy:1');
 db.prepare('INSERT INTO tickets(entry) VALUES(?)').run('second:2');
 assert.equal(db.prepare('SELECT number FROM tickets WHERE entry=?').get('legacy:1').number,1);
 assert.throws(()=>db.prepare('INSERT INTO tickets(entry) VALUES(?)').run('legacy:1'),/UNIQUE/);
 db.prepare('DELETE FROM tickets WHERE number=2').run();
 db.prepare('INSERT INTO tickets(entry) VALUES(?)').run('third:3');
 assert.equal(db.prepare('SELECT number FROM tickets WHERE entry=?').get('third:3').number,3);
 db.close();
});
