import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameOrigin} from '../lib/request-security';
test('origem aceita domínio externo da aplicação atrás de proxy',()=>{
 assert.equal(sameOrigin(new Headers({origin:'https://agenda.example.com',host:'agenda.example.com'})),true);
 assert.equal(sameOrigin(new Headers({origin:'http://127.0.0.1:3001',host:'127.0.0.1:3001'})),true);
 for(const origin of ['https://untrusted.invalid','null','invalid','https://agenda.example.com:444'])assert.equal(sameOrigin(new Headers({origin,host:'agenda.example.com'})),false);
 assert.equal(sameOrigin(new Headers({host:'agenda.example.com'})),false);
});
