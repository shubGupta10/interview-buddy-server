import express from 'express'
import {  explainQuestion, fetchQuestions, fetchQuestionsByRound, fetchRounds, generateQuestions, trackGenerationLimit } from '../controllers/questionControllers.js';
import rateLimit from '../middleware/rateLimit.js';

const questionRoute = express.Router();

questionRoute.post("/generate-questions", generateQuestions);
questionRoute.get("/fetch-questions", fetchQuestions);
questionRoute.get("/fetch-questions-by-round", fetchQuestionsByRound)
questionRoute.get("/fetch-round", fetchRounds);
questionRoute.post("/explain-questions", rateLimit, explainQuestion);
questionRoute.post("/track-generation-limit", trackGenerationLimit);

export default questionRoute