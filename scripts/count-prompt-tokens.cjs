#!/usr/bin/env node
/**
 * Count tokens of the always-loaded instruction files with js-tiktoken.
 *
 * Reports o200k_base (GPT-5.x / Codex) and cl100k_base (GPT-4.x / DeepSeek-ish)
 * for each file, plus per-`## `-section sizes so edits can be diffed.
 *
 * Usage: count-prompt-tokens.cjs [file ...]
 */

const fs = require("node:fs");
const path = require("node:path");
const { Tiktoken } = require("/Users/lb/.pi/agent/npm/node_modules/js-tiktoken/dist/index.cjs");
const o200kRank = require("/Users/lb/.pi/agent/npm/node_modules/js-tiktoken/dist/ranks/o200k_base.cjs");
const cl100kRank = require("/Users/lb/.pi/agent/npm/node_modules/js-tiktoken/dist/ranks/cl100k_base.cjs");

const o200k = new Tiktoken(o200kRank);
const cl100k = new Tiktoken(cl100kRank);
const count = (enc, text) => enc.encode(text).length;

const defaultFiles = [
  path.join(process.env.HOME, ".pi/agent/AGENTS.md"),
  path.join(process.env.HOME, ".pi/agent/APPEND_SYSTEM.md"),
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;
let totalO = 0;
let totalC = 0;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const o = count(o200k, text);
  const c = count(cl100k, text);
  totalO += o;
  totalC += c;
  console.log(`${o.toString().padStart(5)} o200k  ${c.toString().padStart(5)} cl100k  ${file}`);
  const sections = text.split(/\n(?=## )/);
  if (sections.length > 1) {
    for (const section of sections) {
      const title = (section.match(/^#+ .*/) || ["(preamble)"])[0].slice(0, 48);
      console.log(`      ${count(o200k, section).toString().padStart(4)} tok  ${section.length.toString().padStart(5)} ch  ${title}`);
    }
  }
}

if (files.length > 1) {
  console.log(`\nTOTAL: ${totalO} o200k / ${totalC} cl100k tokens across ${files.length} files`);
}
