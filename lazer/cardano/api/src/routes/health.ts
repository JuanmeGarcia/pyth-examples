import { Router } from "express";
import { getScript } from "../cardano/script.js";

const router = Router();

router.get("/health", (_req, res) => {
  try {
    const { scriptAddress, hash } = getScript();
    res.json({
      ok: true,
      network: "Preview",
      scriptAddress,
      scriptHash: hash,
    });
  } catch {
    res.json({ ok: true, network: "Preview", scriptAddress: null });
  }
});

export default router;
