import express from 'express'
import { createCompany, createRound, fetchCompany, fetchRound } from '../controllers/companyController.js';

const companyRoute = express.Router();

companyRoute.post("/create-company", createCompany);
companyRoute.post("/create-round", createRound);
companyRoute.get("/fetch-companies", fetchCompany);
companyRoute.get("/fetch-rounds", fetchRound);

export default companyRoute;