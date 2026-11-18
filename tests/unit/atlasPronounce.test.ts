import { test } from "node:test";
import assert from "node:assert/strict";
import { atlasWordRecording } from "../../services/atlasPronounce.ts";

// 镜像索引元组 [id, word, 释义, 音标, cefrIdx, topicIdx, media]；media: IMG=1 UK=2 US=4 EX=8 EX2=16
const INDEX = {
  words: [
    ["library", "library", "n. 图书馆", "/ˈlaɪbrəri/", 0, 0, 31], // 全媒体
    ["curious", "curious", "adj. 好奇的", "/ˈkjʊəriəs/", 0, 0, 4], // 仅美式
    ["wander", "wander", "vi. 漫游", "/ˈwɒndə/", 0, 0, 2], // 仅英式
    ["picture", "picture", "n. 图片", "/ˈpɪktʃə/", 0, 0, 1], // 仅插画，无录音
  ],
};

// 模块按需懒加载索引并缓存；在首次调用前注入 fetch mock。
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => ({
  ok: true,
  json: async () => INDEX,
})) as unknown as typeof fetch;

const BASE = "https://pathmora.oss-cn-beijing.aliyuncs.com/atlas/v1/audio";

test("词库词默认美式真人录音", async () => {
  assert.equal(await atlasWordRecording("library"), `${BASE}/us/library.mp3`);
});

test("指定英式取英式录音", async () => {
  assert.equal(await atlasWordRecording("library", "uk"), `${BASE}/uk/library.mp3`);
});

test("仅美式录音的词请求英式时回退美式", async () => {
  assert.equal(await atlasWordRecording("curious", "uk"), `${BASE}/us/curious.mp3`);
});

test("仅英式录音的词请求美式时回退英式", async () => {
  assert.equal(await atlasWordRecording("wander", "us"), `${BASE}/uk/wander.mp3`);
});

test("大小写归一后仍能命中", async () => {
  assert.equal(await atlasWordRecording("Library"), `${BASE}/us/library.mp3`);
});

test("只有插画无录音的词返回 null", async () => {
  assert.equal(await atlasWordRecording("picture"), null);
});

test("不在词库的词返回 null（调用方回退原 TTS）", async () => {
  assert.equal(await atlasWordRecording("nonexistentword"), null);
});

test("短语（含空格）无单词录音返回 null", async () => {
  assert.equal(await atlasWordRecording("give up"), null);
});
