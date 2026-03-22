import { Router } from "express";
import { getScript } from "../cardano/script.js";

const router = Router();

router.get("/script", (_req, res) => {
  const { scriptAddress, hash, script } = getScript();
  res.json({
    scriptAddress,
    scriptHash: hash,
    plutusVersion: script.version,
  });
});

export default router;
