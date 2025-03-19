import express from 'express'
import { createCompany, createRound, deleteCompany, deleteRound, fetchCompany, fetchDashboardDetails, fetchRound } from '../controllers/companyController.js';

const companyRoute = express.Router();

companyRoute.post("/create-company", createCompany);
companyRoute.post("/create-round", createRound);
companyRoute.get("/fetch-companies", fetchCompany);
companyRoute.get("/fetch-rounds", fetchRound);
companyRoute.delete("/delete-company", deleteCompany);
companyRoute.delete("/delete-round", deleteRound);
companyRoute.get("/get-dashboard-details", fetchDashboardDetails);

export default companyRoute;