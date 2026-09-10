import test from "node:test";
import assert from "node:assert/strict";
import { encodeWav, downsample } from "../src/wav.js";

test("downsamples mono PCM to the requested rate", () => {
  const input = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10));
  const output = downsample(input, 48000, 16000);
  assert.equal(output.length, 160);
  assert.ok(output.every((value) => value <= 1 && value >= -1));
});

test("encodes a valid 16-bit mono WAV", () => {
  const wav = encodeWav(Float32Array.from([0, 0.5, -0.5, 1]), 16000);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(wav.slice(8, 12)), "WAVE");
  assert.equal(new DataView(wav.buffer).getUint16(22, true), 1);
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 16000);
  assert.equal(wav.byteLength, 44 + 8);
});
