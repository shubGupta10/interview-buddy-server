import express from 'express'
import { generateQuestions } from '../controllers/questionControllers.js';

const questionRoute = express.Router();

questionRoute.post("/generate-questions", generateQuestions)

export default questionRoute