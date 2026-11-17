import express from "express";
import { getHtml } from "../controller/controller.js";

export const router = express.Router();

router.post("/api/articles", getHtml);
