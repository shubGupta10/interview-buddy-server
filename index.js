import express from 'express'
import dotenv from 'dotenv'
import companyRoute from './src/routes/companyRoutes.js';
import questionRoute from './src/routes/questionRoutes.js';
import cors from 'cors'

const app = express();
const PORT = process.env.PORT || 5000;
dotenv.config();


// middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json())

app.use('/company', companyRoute);
app.use('/question', questionRoute);

app.get("/", (req, res) => {
    res.send("Express server is running")
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})