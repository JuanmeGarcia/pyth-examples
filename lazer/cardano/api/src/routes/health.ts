import { Router } from "express";
import { getScript } from "../cardano/script.js";
import { NETWORK } from "../config.js";

const router = Router();

router.get("/health", (_req, res) => {
  try {
    const { scriptAddress, hash } = getScript();
    res.json({
      status: "ok",
      ok: true,
      network: NETWORK[0].toUpperCase() + NETWORK.slice(1),
      scriptAddress,
      scriptHash: hash,
    });
  } catch {
    res.json({
      status: "ok",
      ok: true,
      network: NETWORK[0].toUpperCase() + NETWORK.slice(1),
      scriptAddress: null,
    });
  }
});

export default router;
