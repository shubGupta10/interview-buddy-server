import generateInterviewQuestions from '../ai/generate-questions.js'
import { db } from "../firebase/firebaseAdmin.js";
import admin from 'firebase-admin'
import explainQuestionAnsDeeply from '../ai/explain-questions.js';
import redis from '../redis/redis.js';
import moment from "moment";

export const generateQuestions = async (req, res) => {
    try {
        const { userId, companyId, roundId, roundName, difficulty, language } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", status: false });
        }

        const roundsWithoutLanguage = ["Behavioral Interview", "HR Round", "Managerial Round"];

        if (!companyId || !roundId || !roundName || !difficulty) {
            return res.status(400).json({
                message: "All fields except language are required",
                status: false,
            });
        }

        if (roundsWithoutLanguage.includes(roundName) && language) {
            return res.status(400).json({
                message: `${roundName} does not require a programming language.`,
                status: false,
            });
        }

        if (!roundsWithoutLanguage.includes(roundName) && !language) {
            return res.status(400).json({
                message: `${roundName} requires a programming language.`,
                status: false,
            });
        }

        const redisKey = `rate_limit:${userId}`;
        const requestCount = Number(await redis.get(redisKey)) || 0;

        if (requestCount >= 5) {
            return res.status(429).json({
                message: "You have reached the limit of 5 requests per 6 hours. Please try again later.",
                status: false,
            });
        }

        if (requestCount === 0) {
            await redis.setex(redisKey, 21600, 1); 
        } else {
            await redis.incr(redisKey);
        }

        const batch = db.batch();
        const roundRef = db.collection("companies").doc(companyId).collection("rounds").doc(roundId);

        const generatedAt = admin.firestore.FieldValue.serverTimestamp();
        const question = await generateInterviewQuestions(roundName, difficulty, language);

        const questionsArray = question.map((q) => {
            const questionRef = roundRef.collection("questions").doc();
            batch.set(questionRef, {
                ...q,
                roundId,
                ...(language && { language }),
                createdAt: generatedAt,
                generatedAt: generatedAt
            });
            return { id: questionRef.id, ...q };
        });

        await batch.commit();

        return res.status(200).json({
            success: true,
            message: "Questions generated successfully",
            roundId,
            ...(language && { language }),
            questions: questionsArray,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const fetchQuestions = async (req, res) => {
    try {
        const { companyId, roundId, language } = req.query;

        if (!companyId || !roundId) {
            return res.status(400).json({
                success: false,
                message: "Company Id and Round Id are required",
            });
        }

        const questionRef = db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .doc(roundId)
            .collection("questions");

        let query;

        // If language is provided, filter by language
        if (language) {
            query = questionRef
                .where("language", "==", language)
                .orderBy("generatedAt", "desc")
                .limit(20);
        } else {
            query = questionRef
                .orderBy("generatedAt", "desc")
                .limit(20);
        }

        const snapShot = await query.get();

        if (snapShot.empty) {
            console.log("No questions found for the given criteria.");
            return res.status(200).json({ success: true, questions: [] });
        }

        const questions = snapShot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return res.status(200).json({
            success: true,
            questions,
        });
    } catch (error) {
        console.error("Error fetching questions:", error.stack || error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const fetchRounds = async (req, res) => {
    try {
        const { companyId } = req.query;
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required",
            });
        }

        const roundsSnapshot = await db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .orderBy("createdAt", "desc")
            .get();

        if (roundsSnapshot.empty) {
            return res.status(200).json({ success: true, rounds: [] });
        }

        const rounds = roundsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        return res.status(200).json({ success: true, rounds });
    } catch (error) {
        console.error("Error fetching rounds:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const fetchQuestionsByRound = async (req, res) => {
    try {
        const { companyId, roundId, language, difficulty } = req.query;
        
        if (!companyId || !roundId) {
            return res.status(400).json({
                success: false,
                message: "Company ID and Round ID are required",
            });
        }

        let query = db
            .collection("companies")
            .doc(companyId)
            .collection("rounds")
            .doc(roundId)
            .collection("questions")
            .orderBy("generatedAt", "desc");

        if (language) {
            query = query.where("language", "==", language);
        }

        if (difficulty) {
            query = query.where("difficulty", "==", difficulty);
        }

        const questionsSnapshot = await query.get();

        if (questionsSnapshot.empty) {
            return res.status(200).json({ success: true, questions: [] });
        }

        const questions = questionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        return res.status(200).json({ success: true, questions });
    } catch (error) {
        console.error("Error fetching questions:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const explainQuestion = async (req, res) => {
    try {
        const { questionId, question } = req.body;
        if (!questionId || !question) {
            return res.status(400).json({
                message: "Question ID and question are required.",
                status: 400
            });
        }

        const explanation = await explainQuestionAnsDeeply(question);

        return res.status(200).json({
            message: "Explanation generated successfully.",
            explanation,
            status: 200
        });
    } catch (error) {
        console.error("Error generating explanation:", error);
        return res.status(500).json({
            message: "Failed to generate explanation.",
            error: error.message,
            status: 500
        });
    }
}

export const trackGenerationLimit = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", status: false });
        }

        const redisKey = `rate_limit:${userId}`;
        const requestCount = Number(await redis.get(redisKey)) || 0;
        const ttl = await redis.ttl(redisKey);

        const timeLeft = ttl > 0 ? moment.duration(ttl, "seconds").humanize() : "Now";

        return res.status(200).json({
            success: true,
            message: "Generation limit status retrieved successfully",
            used: requestCount, 
            remaining: Math.max(0, 5 - requestCount),
            resetIn: timeLeft
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

