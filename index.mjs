import { Router } from 'express';
import { jsonParser } from '../../src/express-common.js';
import { createRequire } from 'module';
import { delay, uuidv4 } from '../../src/util.js';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
const require  = createRequire(import.meta.url);
const path = require('path');
const mime = require('mime-types');
const sanitize = require('sanitize-filename');
const fs = require('fs');
const readline = require('readline');
const jimp = require('jimp');
const writeFileAtomicSync = require('write-file-atomic').sync;
const open = require('open');




let roots = [];
const initChat = (root, avatar, file)=>{
	const char = avatar.replace(/(\.png)?$/, '');
	const dirPath = path.resolve(path.join(...[
		root,
		'chats',
		char,
	]));

	if (!fs.existsSync(dirPath)) {
		roots = [];
		return;
	}
	const lstat = fs.lstatSync(dirPath);
	if (!lstat.isDirectory()) {
		roots = [];
		return;
	}

	const chats = [];
	for (const f of fs.readdirSync(dirPath, { withFileTypes:true })) {
		if (!f.isFile()) continue;
		if (!f.name.endsWith('.jsonl')) continue;
		chats.push(fs.readFileSync(path.join(dirPath, f.name), { encoding:'utf-8' })
			.split('\n')
			.map((line,idx)=>idx == 0 ? ({filename:f.name, ...JSON.parse(line)}) : JSON.parse(line))
		);
	}
	const max = Math.max(...chats.map(it=>it.length));
	const thisChatIdx = chats.findIndex(it=>it[0].filename == file);
	const thisChat = chats.splice(thisChatIdx, 1);
	chats.unshift(...thisChat)
	const tree = x(1, chats);
	const list = [];
	let node = tree[0];
	while (node) {
		if (node.next.length > 1) {
			list.push(node.next.map(n=>({
				source: n.source,
				count: n.count,
				text: n.text,
			})));
		} else {
			list.push(null);
		}
		node = node.next?.find(n=>n.source.includes(file));
	}
	return list;
};
const x = (idx, pool)=>{
	const open = [...pool];
	const branches = [];
	while (open.length) {
		const chat = open.shift();
		if (idx >= chat.length) continue;
		const text = chat[idx].mes;
		const same = open.filter(it=>it[idx]?.mes == text);
		if (idx == 1) while (open.pop());
		else for (const c of same) open.splice(open.indexOf(c), 1);
		const message = {
			text,
			source: [chat, ...same].map(it=>it[0].filename),
			count: [chat, ...same].map(it=>it.length - 1 - idx),
			next: x(idx + 1, [chat, ...same]),
		};
		if (message.next.length == 1) message.next[0].text = null;
		branches.push(message);
	}
	return branches;
};






/**
 *
 * @param {Router} router
 */
export async function init(router) {
	router.get('/', jsonParser, (req, res)=>{
		res.send('Quick Branch Switch Plugin');
	});

	router.post('/init', jsonParser, (req, res)=>{
		const list = initChat(req.user.directories.root, req.body.avatar, req.body.file);
		res.send(list);
	});
}

export async function exit() {}

const module = {
    init,
    exit,
    info: {
        id: 'qbs',
        name: 'Quick Branch Switch Plugin',
        description: '...',
    },
};
export default module;
