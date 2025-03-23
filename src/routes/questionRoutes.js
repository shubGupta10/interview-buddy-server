import express from 'express'
import {  deleteQuestionByDifficulty, deleteQuestionByLanguage, deleteQuestionsByRound, explainQuestion, fetchQuestions, fetchQuestionsByRound, fetchRounds, generateQuestions, trackGenerationLimit } from '../controllers/questionControllers.js';
import rateLimit from '../middleware/rateLimit.js';

const questionRoute = express.Router();

questionRoute.post("/generate-questions", generateQuestions);
questionRoute.get("/fetch-questions", fetchQuestions);
questionRoute.get("/fetch-questions-by-round", fetchQuestionsByRound)
questionRoute.get("/fetch-round", fetchRounds);
questionRoute.post("/explain-questions", rateLimit, explainQuestion);
questionRoute.post("/track-generation-limit", trackGenerationLimit);
questionRoute.delete('/delete-questions-by-roundId', deleteQuestionsByRound)
questionRoute.delete("/delete-questions-by-language", deleteQuestionByLanguage);
questionRoute.delete("/delete-questions-by-difficulty", deleteQuestionByDifficulty);

export default questionRoute