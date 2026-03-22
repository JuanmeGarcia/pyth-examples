import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyParamsToScript,
  resolvePlutusScriptAddress,
  type PlutusScript,
} from "@meshsdk/core";

interface Blueprint {
  validators: { title: string; compiledCode: string; hash: string }[];
}

let _cache: { script: PlutusScript; scriptAddress: string; hash: string } | null =
  null;

/**
 * Load the compiled Aiken validator from plutus.json (singleton).
 * Defaults to ../../aiken/plutus.json relative to the api/ root.
 */
export function loadScript(plutusPath?: string) {
  if (_cache) return _cache;

  const path = plutusPath ?? resolve(import.meta.dirname, "../../../aiken/plutus.json");

  const raw = readFileSync(path, "utf-8");
  const blueprint: Blueprint = JSON.parse(raw);
  const validator = blueprint.validators[0];

  if (!validator) {
    throw new Error(`No validators found in ${path}`);
  }

  const scriptCbor = applyParamsToScript(validator.compiledCode, []);

  const script: PlutusScript = {
    code: scriptCbor,
    version: "V3",
  };

  // 0 = testnet for Mesh's resolvePlutusScriptAddress
  const scriptAddress = resolvePlutusScriptAddress(script, 0);

  _cache = { script, scriptAddress, hash: validator.hash };
  return _cache;
}

export function getScript() {
  if (!_cache) throw new Error("Script not loaded — call loadScript() first");
  return _cache;
}
