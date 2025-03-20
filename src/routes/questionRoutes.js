import express from 'express'
import {  explainQuestion, fetchQuestions, fetchQuestionsByRound, fetchRounds, generateQuestions } from '../controllers/questionControllers.js';

const questionRoute = express.Router();

questionRoute.post("/generate-questions", generateQuestions);
questionRoute.get("/fetch-questions", fetchQuestions);
questionRoute.get("/fetch-questions-by-round", fetchQuestionsByRound)
questionRoute.get("/fetch-round", fetchRounds);
questionRoute.post("/explain-questions", explainQuestion);

export default questionRoute