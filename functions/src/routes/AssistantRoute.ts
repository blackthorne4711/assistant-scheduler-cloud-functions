import {Router} from "express";

const assistantRoute = Router();

assistantRoute.get("/assistant", async (req, res) => {
  return res.status(200).json("{}");
});

export {assistantRoute};
