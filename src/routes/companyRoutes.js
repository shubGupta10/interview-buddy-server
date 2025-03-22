import express from 'express'
import { createCompany, createRound, deleteCompany, deleteRound, fetchCompany, fetchDashboardDetails, fetchRound } from '../controllers/companyController.js';
import rateLimit from '../middleware/rateLimit.js'

const companyRoute = express.Router();

companyRoute.post("/create-company", rateLimit, createCompany);
companyRoute.post("/create-round", createRound);
companyRoute.get("/fetch-companies", rateLimit, fetchCompany);
companyRoute.get("/fetch-rounds", fetchRound);
companyRoute.delete("/delete-company", deleteCompany);
companyRoute.delete("/delete-round", deleteRound);
companyRoute.get("/get-dashboard-details", rateLimit, fetchDashboardDetails);

export default companyRoute;