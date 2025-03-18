import express from 'express'
import { fetchQuestions, generateQuestions } from '../controllers/questionControllers.js';

const questionRoute = express.Router();

questionRoute.post("/generate-questions", generateQuestions);
questionRoute.get("/fetch-questions", fetchQuestions);

export default questionRoute