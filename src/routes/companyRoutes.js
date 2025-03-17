import express from 'express'
import { createCompany, createRound } from '../controllers/companyController.js';

const companyRoute = express.Router();

companyRoute.post("/create-company", createCompany);
companyRoute.post("/create-round", createRound);

export default companyRoute;